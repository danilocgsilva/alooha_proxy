## Question

Look to my reverse proxy server
```
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

    let completed = false;

    body.on("end", () => {
      logWritter.log("End body event emitted.");
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
      // When releaseClient is true, we still want to process the end event for cleanup
      res.on("close", () => {
        try {
          body.destroy();
        } catch (err) {
          console.error("Failed to destroy upstream body:", err);
        }
      });

      // For releaseClient=true, we still need to ensure cleanup happens on stream end
      body.on("end", () => {
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
The idea here is, when providing the `releaseClient` flag, the Ollama might continue to stream ansewer, and the reverse proxy code might also continue to read and process the chunks received even after the client get closed. Then, at the end, the `finishQuestionIfNeeded` method is executed at the end of the answer streaming (even after the client is closed).

How to fix it?

## System proxy

You are a experienced TypeScript and web developer.
Keep the current coding style.

## Answer

The problem here is that when `releaseClient` is true, your proxy continues processing the upstream stream even after the client has disconnected. This can cause issues like:

1. Memory leaks from keeping references to destroyed streams.
2. Unnecessary resource usage.
3. Potential race conditions or inconsistent state if cleanup isn't handled properly.

### ✅ Key Fixes Needed

We want to ensure:
- If `releaseClient === true`, we **still** handle client disconnection gracefully.
- The proxy **does not keep streaming** once the client is gone (unless explicitly needed).
- Resource cleanup happens reliably even after client disconnects.
- We avoid calling `finishQuestionIfNeeded()` multiple times.

---

### 🔧 Suggested Changes

Here’s how you can adjust your code for better handling of this scenario:

#### ✅ 1. Track whether response has been closed or aborted
Use a flag (`responseClosed`) to prevent redundant cleanup and ensure proper lifecycle management.

```ts
let completed = false;
let responseClosed = false;

const handleCloseEvent = () => {
  if (requestIntentString === 'option') return;

  logWritter.log("Close signal received.");
  if (upstreamAborted) return;
  upstreamAborted = true;
  upstreamAbortController.abort();

  responseClosed = true; // Mark that response was closed

  try {
    body.destroy();
  } catch (err) {
    console.error("Failed to destroy upstream body:", err);
  }
};
```

#### ✅ 2. Guard against duplicate calls to `finishQuestionIfNeeded`
Only call it once and only if not already completed.

```ts
body.on("end", () => {
  logWritter.log("End body event emitted.");
  if (!completed && !responseClosed) {
    completed = serverDomain.finishQuestionIfNeeded(
      completed,
      requestIntentString,
      questionAnatomy,
      totalBytes,
      totalChunks
    );
  }
});
```

#### ✅ 3. Handle `close` event and avoid duplicate cleanup

In both cases (`releaseClient === true` or false), make sure you do not re-run cleanup logic if already done.

```ts
// Inside close handler for releaseClient = true case:
res.on("close", () => {
  if (responseClosed) return; // Prevent duplicate actions
  responseClosed = true;

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
```

#### ✅ 4. Ensure `body.on("end")` only runs once even when releaseClient is true

You already have this logic, but double-check that you're not calling it twice:

```ts
body.on("end", () => {
  logWritter.log("End body event emitted.");
  if (!completed && !responseClosed) {
    completed = serverDomain.finishQuestionIfNeeded(
      completed,
      requestIntentString,
      questionAnatomy,
      totalBytes,
      totalChunks
    );
  }
});
```

---

### 📌 Summary of Key Improvements

| Concern | Fix |
|--------|-----|
| Multiple cleanup calls | Use `responseClosed` flag to prevent redundant operations |
| Resource leak on early disconnect | Always destroy stream in close handlers |
| Avoid duplicate `finishQuestionIfNeeded()` | Guard with `completed && !responseClosed` |
| Properly track stream completion | Ensure all paths lead to one final cleanup |

---

### 💡 Optional Enhancement: Add Timeout for Cleanup

If you want more control, consider adding a timeout-based fallback to force cleanup:

```ts
const cleanupTimeout = setTimeout(() => {
  if (!completed && !responseClosed) {
    logWritter.log("Force cleanup due to timeout");
    completed = serverDomain.finishQuestionIfNeeded(
      completed,
      requestIntentString,
      questionAnatomy,
      totalBytes,
      totalChunks
    );
  }
}, 10_000); // 10 seconds after stream ends

body.on("end", () => {
  clearTimeout(cleanupTimeout);
  ...
});
```

This helps with edge cases where neither `close` nor `end` fires properly.

---

Let me know if you'd like a **refactored version of the full function block** incorporating these fixes.
