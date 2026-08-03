## Question

Look to my reverse proxy code:
```ts
import express from "express";
import { request } from "undici";
import type QuestionAnatomy from "./types/QuestionAnatomy.js";
import MetricWorks from "./server_domain/MetricWorks.js";
import MetricLifeCycle from "./server_domain/MetricLifeCycle.js";
import RequestIntent from "./server_domain/RequestIntent.js";
import LogImplementation from "./server_domain/LogImplementation.js";
import { AppDataSource } from "./database/dataSource.js";
import QuestionProcessingHelper from "./server_domain/QuestionProcessingHelper.js";
import { v4 as uuidv4 } from 'uuid';
import HistoryStats from "./database/services/HistoryStats.js";
import ServerDomain from "./domain/ServerDomain.js";

const app = express();

app.use(express.raw({ type: "*/*" }));

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept, X-Release-Client");
    res.header("Access-Control-Max-Age", "86400"); // 24 horas
    
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
});

const OLLAMA_URL = `http://host.docker.internal:${process.env.OLLAMA_PORT ?? "11434"}`;

app.all(/.*/, async (req: express.Request, res: express.Response) => {
  const logWritter = new LogImplementation();
  const targetUrl = `${OLLAMA_URL}${req.originalUrl}`;
  const metricLifeCycle = new MetricLifeCycle();
  let questionAnatomy: QuestionAnatomy | null = null;
  const requestIntent: RequestIntent = new RequestIntent(req);
  const requestIntentString = requestIntent.getIntent();
  const formatter = QuestionProcessingHelper.getFormatter();
  const formatterMilliseconds = QuestionProcessingHelper.getFormatterMilliseconds();
  let uuid: string;
  const timeout = 1000 * 60 * 60 * 3;
  const serverDomain = new ServerDomain(logWritter, metricLifeCycle);

  const headers = { ...req.headers };

  delete headers.host;
  delete headers["content-length"];
  delete headers.connection;

  logWritter.log(`Intent: ${requestIntentString || "unknown"}`);

  // Flag to determine if we should release client after initial request
  const releaseClient = req.header("X-Release-Client") === "true";

  if (requestIntentString === "alooha_stats") {
    let historyStats = new HistoryStats();
    let statsData = await historyStats.getModelCounts();
    return res.status(200).json({ message: statsData });
  }

  if (requestIntentString === "question") {
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept, X-Release-Client");
    questionAnatomy = MetricWorks.getAnatomy(req.body.toString(), req);
    metricLifeCycle.setWhenBegan();
    metricLifeCycle.setUserIp(req);

    logWritter.log(`I got your question:`);
    logWritter.log("=============================");
    logWritter.log(questionAnatomy.question);

    uuid = uuidv4();
    logWritter.log(`Uuid: ${uuid}`);
    if (questionAnatomy.systemPrompt) {
      logWritter.log("System prompt:");
      logWritter.log("==========");
      logWritter.log(questionAnatomy.systemPrompt);
    }
    logWritter.log(`Model choosed: ${questionAnatomy.model}`);
    logWritter.log(`Timeout: ${timeout / 1000} seconds`);

    const date = new Date();
    logWritter.log(`Your question got -> ${questionAnatomy.question.length} <- characters.`);
    logWritter.log(`===> ${formatter.format(date)}`);
  }

  try {
    const upstreamAbortController = new AbortController();
    let upstreamAborted = false;

    req.on("aborted", () => {
      logWritter.log("Abort signal received.");
      if (upstreamAborted) return;
      upstreamAborted = true;
      upstreamAbortController.abort();
    });

    // Only handle close event if releaseClient is false
    const handleCloseEvent = () => {
      if (requestIntentString === 'option') return;

      logWritter.log("Close signal received.");
      if (upstreamAborted) return;
      upstreamAborted = true;
      upstreamAbortController.abort();
    };

    // Only attach close handler if not releasing client
    if (!releaseClient) {
      res.on("close", handleCloseEvent);
    }

    const { body, statusCode, headers: upstreamHeaders } = await request(targetUrl, {
      method: req.method,
      headers,
      body: req.body && req.body.length ? req.body : undefined,
      signal: upstreamAbortController.signal,

      headersTimeout: timeout,
      bodyTimeout: timeout,
    });

    res.status(statusCode);

    QuestionProcessingHelper.assemblyHeader(res, upstreamHeaders);

    let totalBytes = 0;
    let totalChunks = 0;
    let hasStartedStreaming = false;
    let completed = false;
    let responseEnded = false;

    body.on("data", (chunk: Buffer) => {
      totalBytes += chunk.length;
      hasStartedStreaming = true;
      if (requestIntentString === "question") {
        const chunksResponse = metricLifeCycle.digestChunk(chunk);
        if ("" !== chunksResponse) {
          totalChunks++;
          logWritter.log(`-> chunk: ${uuid}, ${formatterMilliseconds.format(new Date())} <-`);
          logWritter.log(`--->${chunksResponse}<---`);
        }
      }
    });

    body.on("error", (err) => {
      const codeString = (err as NodeJS.ErrnoException).code;
      const errorName = (err as NodeJS.ErrnoException).name;
      const abortErrorCodeString = codeString === 'UND_ERR_ABORTED';
      const abortErrorName = errorName === 'AbortError';

      if (abortErrorCodeString || abortErrorName) {
        // If releaseClient is true, treat this as expected behavior
        if (releaseClient) {
          logWritter.log("Client disconnected gracefully (releaseClient=true). Continuing processing.");
        } else {
          logWritter.log("Aborted by user or the client has been closed.");
        }
      } else {
        logWritter.log("OOPS! An error!");
        console.error("Stream error:", err);
      }

      if (!releaseClient) {
        res.destroy(err);
      }
    });

    body.pipe(res);

    // Handle response end for cleanup
    body.on("end", () => {
      logWritter.log("End body event emitted.");
      responseEnded = true;
      
      if (!completed) {
        completed = serverDomain.finishQuestionIfNeeded(
          completed,
          requestIntentString,
          questionAnatomy,
          totalBytes,
          totalChunks
        );
      }
    });

    // Handle response close for cleanup only when not releasing client
    if (!releaseClient) {
      res.on("close", () => {
        if (!completed && QuestionProcessingHelper.shouldLogCancellationMessage(completed, hasStartedStreaming)) {
          logWritter.log(QuestionProcessingHelper.getRequestCancellationMessage(requestIntentString || "unknown"));
        }

        try {
          body.destroy();
        } catch (err) {
          console.error("Failed to destroy upstream body:", err);
        }

        if (!completed) {
          completed = serverDomain.finishQuestionIfNeeded(
            completed,
            requestIntentString,
            questionAnatomy,
            totalBytes,
            totalChunks
          );
        }
      });
    } else {
      // When releaseClient is true, we want to process cleanup only when response ends
      const cleanupHandler = () => {
        try {
          body.destroy();
        } catch (err) {
          console.error("Failed to destroy upstream body:", err);
        }
        
        if (!completed && responseEnded) {
          completed = serverDomain.finishQuestionIfNeeded(
            completed,
            requestIntentString,
            questionAnatomy,
            totalBytes,
            totalChunks
          );
        }
      };

      // Listen for both close and finish events
      res.on("close", cleanupHandler);
      res.on("finish", cleanupHandler);
    }

  } catch (err) {
    console.error("Proxy error:", err);
    res.status(502).json({ error: "Bad Gateway" });
  }
});

const portToServe: number = 11001;

app.listen(portToServe, "0.0.0.0", () => {
  AppDataSource.initialize();
  console.log(`Proxy running on :${portToServe.toString()}`);
});
```
And look to the following command:
```ts
body.pipe(res);
```
This command relay the upstream responses to the downstream for each chunk. But I need to do it conditionally.
Could you give me a suggestion to replace this command to do the same thing, but allowing me to introduce a condition to do so?

## System prompt

You are a senior TypeScript and web developer.

## Answer

You're absolutely right in wanting to make `body.pipe(res)` conditional — this is a common need when you want to:

- **Filter or modify** chunks before sending them downstream.
- **Skip piping entirely** under certain conditions (e.g., if there was an error, or if the client disconnected).
- **Add logging or metrics** per chunk.

---

### ✅ Goal

Replace:
```ts
body.pipe(res);
```

With a version that allows you to:
1. Conditionally decide whether to pipe each chunk.
2. Possibly transform or log chunks.
3. Handle cleanup properly (e.g., when the client disconnects).

---

## 🔧 Suggested Solution: Manual Chunk Handling with `pipe()` Replacement

We'll manually iterate through the upstream response stream (`body`) and selectively pipe each chunk to the downstream (`res`). You can add logic inside this loop to control what gets piped.

Here’s how you could refactor that part of your code:

---

### ✨ Refactored Stream Handling Logic

Replace the line:
```ts
body.pipe(res);
```

With something like this:

```ts
let shouldPipe = true;

const processChunk = (chunk: Buffer) => {
  // Example condition to skip piping
  if (!shouldPipe) return;

  // Optional: Transform chunk here if needed
  const transformedChunk = chunk; // or do some transformation

  // Pipe the chunk downstream
  const wrote = res.write(transformedChunk);
  
  // If write returns false, pause upstream until drain
  if (!wrote) {
    body.pause();
    res.on("drain", () => {
      body.resume();
    });
  }
};

body.on("data", (chunk: Buffer) => {
  totalBytes += chunk.length;
  hasStartedStreaming = true;

  if (requestIntentString === "question") {
    const chunksResponse = metricLifeCycle.digestChunk(chunk);
    if ("" !== chunksResponse) {
      totalChunks++;
      logWritter.log(`-> chunk: ${uuid}, ${formatterMilliseconds.format(new Date())} <-`);
      logWritter.log(`--->${chunksResponse}<---`);
    }
  }

  // YOUR CONDITIONAL PIPE LOGIC GOES HERE
  if (/* your condition here */) {
    processChunk(chunk);
  } else {
    // Optionally, skip the chunk or handle differently
    logWritter.log("Skipping chunk due to condition.");
  }
});
```

---

### ⚠️ Important Notes

1. **Use `res.write()` instead of `pipe()`** — This gives you fine-grained control.
2. **Handle backpressure properly** — If `res.write()` returns `false`, pause the upstream and resume after `drain`.
3. **Ensure cleanup in all paths** — Especially if `shouldPipe` is toggled to `false`.

---

### 🛠️ Example Condition: Skip Piping Based on a Flag or Request Header

Let’s say you want to skip piping based on a custom header like `"X-Skip-Response"`:

```ts
const skipResponse = req.header("X-Skip-Response") === "true";
if (skipResponse) {
  shouldPipe = false;
}
```

Then inside `processChunk`, use:
```ts
if (!shouldPipe) return;
```

Or even better, conditionally write only if not skipped:

```ts
if (skipResponse) {
  logWritter.log("Skipping response due to X-Skip-Response header.");
} else {
  res.write(chunk);
}
```

---

### 🧹 Cleanup

Make sure that you still clean up the stream properly in `end`, `close`, and error handlers.

If you're not using `pipe(res)` anymore, don't forget:

```ts
res.on("finish", () => {
  body.destroy(); // optional but good for cleanup
});
```

Also ensure `body` is destroyed on errors or early exits.

---

## 🧪 Optional Advanced Use Case: Filter Response by Content

If you'd like to filter out certain parts of the stream (e.g., don’t send tokens containing `"error"`), you could do:

```ts
const text = chunk.toString();
if (!text.includes("error")) {
  res.write(chunk);
} else {
  logWritter.log("Filtered out error-containing chunk.");
}
```

---

## ✅ Final Thoughts

You've now replaced the simple `pipe()` with a more flexible approach that lets you:

- Add conditional logic.
- Modify or filter chunks.
- Handle streaming efficiently and safely.

Would you like help extracting this into a reusable utility function?
