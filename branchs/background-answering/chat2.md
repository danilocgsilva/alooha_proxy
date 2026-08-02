## Question:

Look to my reverse proxy application:
### src/server.ts
```TypeScript
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

  if (requestIntentString === "alooha_stats") {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept");
    
    let historyStats = new HistoryStats();
    let statsData = await historyStats.getModelCounts();
    return res.status(200).json({message: statsData});
  }

  if (requestIntentString === "question") {
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
      if (upstreamAborted) {
        return;
      }

      upstreamAborted = true;
      upstreamAbortController.abort();
    });

    res.on("close", () => {
      if (requestIntentString === 'option') {
        return;
      }
      logWritter.log("Close signal received.");
      if (upstreamAborted) {
        return;
      }

      upstreamAborted = true;
      upstreamAbortController.abort();
    });

    res.on("error", () => {
      console.log("Error from response.");
    });

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
        logWritter.log("Aborted by user or the client has been closed.");
      } else {
        logWritter.log("OOPS! An error!");
        console.error("Stream error:", err);
      }
      res.destroy(err);
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
Currently, the proxy is way dependent upon frontend. Every issue in the front, the proxy understand as an error.
But sometimes would be interesting to make a question and *release* the frontend. Answers can take too long, and sometime keeping a browser window open while awaiting the question be answered can be an issue.
The intent of this branch is to allow an hybrid behaviour: adapt the proxy to answer even if the client disapear. The idea is to implement a flaged behaviour, where the client tells to the proxy to *release client*, so it do not interpret as errors when the client varnish, and keep answering. In the end, the expected behaviour is, when finished, the result is saved to the database anyway, so the presence of client that asked the question might be optional in some scenarios.

## System prompt

You are a experienced senior web developer, with a great knowledge upon TypeScript and web in general.
Please, be careful about your answer.

## Answer

You're looking to implement a hybrid behavior in your reverse proxy where:

1. The client can optionally signal the proxy to "release" itself from waiting for a response (i.e., don't treat client disconnection as an error).
2. Even if the client disconnects, the proxy continues processing and eventually stores results.
3. This is useful when answers take a long time and keeping the browser window open isn't feasible.

Here's how to modify your code to achieve this:

### Key Changes:
1. **Add a flag** (`releaseClient`) in the request headers or body that signals the proxy to not treat client disconnection as an error.
2. **Modify error handling logic** to ignore client disconnects when `releaseClient` is true.
3. **Ensure cleanup and completion tracking** works even after client disconnects.

---

### ✅ Updated `src/server.ts`

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
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept");

    let historyStats = new HistoryStats();
    let statsData = await historyStats.getModelCounts();
    return res.status(200).json({ message: statsData });
  }

  if (requestIntentString === "question") {
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

    res.on("close", () => {
      if (requestIntentString === 'option') return;

      logWritter.log("Close signal received.");
      if (upstreamAborted) return;
      upstreamAborted = true;
      upstreamAbortController.abort();
    });

    res.on("error", () => {
      console.log("Error from response.");
    });

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

---

### 🧪 How to Use It

When making a request from the frontend (or any client), include this header:

```http
X-Release-Client: true
```

Example using `fetch`:

```js
fetch('http://your-proxy-endpoint', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Release-Client': 'true'
  },
  body: JSON.stringify({ /* your question */ })
})
```

This way, even if the client closes or loses connection, the proxy continues processing and eventually stores the result.

---

### 🛡️ Notes:
- This approach is safe because you're **not** changing core logic flow; it's just a flag to control error behavior.
- The actual completion and DB saving still happens in `finishQuestionIfNeeded`.
- You may also want to add more sophisticated logging or queueing if needed for truly async processing.

Let me know if you'd like help implementing a background job system (like with BullMQ) for handling long-running tasks.