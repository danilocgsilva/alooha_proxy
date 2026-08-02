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
Look to the `releaseClient` flag. When provided, this flag, suposedly, should continue to process the upstream streamed response, but actually it is not hapenning. Maybe the upstream continue to stream the answer, but the proxy currenctly do not process anything, but should keep processing up to the end of the answer, where the finishQuestionIfNeeded method is triggered to save the processing data, even after the client is closed.
What is wrong to this code? What must I do to make the reverse proxy continue its processing after the client is closed?

## System prompt

You are a experienced TypeScript and web developer.
Pay atention to what I wrote in the prompt. The code might not do exactly what is supposed and you need to spot the understand and spot the problem that I am experiencing.

## Answer

Looking at your reverse proxy code, I can identify several issues with the `releaseClient` flag implementation. The main problem is that when `releaseClient` is true, you're still attaching event listeners that will be triggered even after the client disconnects, but the logic for continuing processing isn't properly implemented.

Here are the key issues and solutions:

## Main Problems:

1. **Event listener attachment**: You're still attaching `res.on("close")` and `body.on("end")` handlers even when `releaseClient` is true
2. **No proper continuation logic**: The code doesn't ensure processing continues after client disconnect
3. **Resource cleanup timing**: The `body.destroy()` calls happen at the wrong times

## Fixed Implementation:

```typescript
app.all(/.*/, async (req: express.Request, res: express.Response) => {
  // ... existing code ...

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

    // Store original response methods for proper cleanup
    const originalResWrite = res.write;
    const originalResEnd = res.end;
    
    // For releaseClient=true, we need to ensure processing continues even after client disconnects
    let processingContinues = false;
    let completed = false;

    if (releaseClient) {
      // When releaseClient is true, we want to continue processing regardless of client disconnect
      logWritter.log("Release client mode enabled - continuing processing after client disconnect");
      
      // We still need to track the stream completion for cleanup
      const originalOnClose = res.on.bind(res);
      const originalOnEnd = body.on.bind(body);
      
      // Override the close event to not immediately destroy the response
      res.on = function(event, listener) {
        if (event === "close") {
          // Store the original close handler for later use
          const originalCloseHandler = listener;
          
          // Wrap it to allow continued processing
          return originalOnClose(event, (err?: Error) => {
            logWritter.log("Client closed, but continuing processing...");
            // Don't call originalCloseHandler immediately - let processing continue
            // But still track that close happened for cleanup purposes
            if (!completed && !processingContinues) {
              processingContinues = true;
            }
            // Call the original handler only if needed for other purposes
          });
        }
        return originalOnClose(event, listener);
      };
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
      
      // Even in releaseClient mode, we can still pipe data if needed
      if (!releaseClient) {
        res.write(chunk);
      }
    });

    body.on("error", (err) => {
      const codeString = (err as NodeJS.ErrnoException).code;
      const errorName = (err as NodeJS.ErrnoException).name;
      const abortErrorCodeString = codeString === 'UND_ERR_ABORTED';
      const abortErrorName = errorName === 'AbortError';

      if (abortErrorCodeString || abortErrorName) {
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

    // For releaseClient mode, we need to ensure we still process the entire stream
    const handleStreamEnd = () => {
      logWritter.log("End body event emitted.");
      
      if (!completed) {
        completed = serverDomain.finishQuestionIfNeeded(
          completed,
          requestIntentString,
          questionAnatomy,
          totalBytes,
          totalChunks
        );
        
        // Ensure we clean up properly even after client disconnect
        try {
          body.destroy();
        } catch (err) {
          console.error("Failed to destroy upstream body:", err);
        }
      }
    };

    body.on("end", handleStreamEnd);

    // Handle response close for cleanup
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
      // When releaseClient is true, we continue processing even after client disconnect
      res.on("close", () => {
        logWritter.log("Client disconnected in releaseClient mode - continuing stream processing...");
        
        // The stream will continue processing in the background
        // We don't destroy the response here, let it finish naturally
        if (!processingContinues) {
          processingContinues = true;
        }
      });
      
      // For releaseClient=true, we still want to ensure cleanup happens on stream end
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

    // Actually pipe the response - this is key for releaseClient mode
    if (!releaseClient) {
      body.pipe(res);
    } else {
      // In releaseClient mode, we still need to handle the streaming but don't send it to client
      // The stream will be processed for completion, but not sent to client
      body.on("data", (chunk: Buffer) => {
        // Just process chunks for metrics/logging, don't pipe to client
        if (requestIntentString === "question") {
          const chunksResponse = metricLifeCycle.digestChunk(chunk);
          if ("" !== chunksResponse) {
            totalChunks++;
            logWritter.log(`-> chunk: ${uuid}, ${formatterMilliseconds.format(new Date())} <-`);
            logWritter.log(`--->${chunksResponse}<---`);
          }
        }
      });
    }

  } catch (err) {
    console.error("Proxy error:", err);
    res.status(502).json({ error: "Bad Gateway" });
  }
});
```

## Simpler and Cleaner Solution:

However, a much simpler approach would be to just remove the `res.on("close")` handler when `releaseClient` is true and let the stream process naturally:

```typescript
// Simplified version - modify this section:
if (releaseClient) {
  // When releaseClient is true, we don't want to close response early
  // Just let the stream continue processing
  logWritter.log("Release client mode enabled - continuing processing after client disconnect");
  
  // Remove the close handler that would destroy the response
  // The body will be processed normally and finishQuestionIfNeeded called at end
} else {
  // Normal behavior with close handler
  res.on("close", handleCloseEvent);
}
```

## Key Points:

1. **The main issue**: You're still calling `body.pipe(res)` in releaseClient mode, which sends the response to the client
2. **Solution**: In releaseClient mode, you should process the stream for metrics/logging but not pipe it to the client
3. **Ensure completion**: The `body.on("end")` handler should still be attached to call `finishQuestionIfNeeded`

The key fix is ensuring that even when `releaseClient=true`, the upstream stream continues to be processed to completion, and your cleanup/finish logic gets called at the end of the stream processing.
