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
  const metricLifeCycle = new MetricLifeCycle(logWritter);
  let questionAnatomy: QuestionAnatomy | null = null;
  const requestIntent: RequestIntent = new RequestIntent(req);
  const requestIntentString = requestIntent.getIntent();
  const formatter = QuestionProcessingHelper.getFormatter();
  const formatterMilliseconds = QuestionProcessingHelper.getFormatterMilliseconds();
  let uuid: string;
  const timeout = 1000 * 60 * 60 * 3;
  const serverDomain = new ServerDomain(logWritter, metricLifeCycle);
  const metricWorks = new MetricWorks(logWritter);

  const headers = { ...req.headers };

  delete headers.host;
  delete headers["content-length"];
  delete headers.connection;

  logWritter.log(`Intent: ${requestIntentString || "unknown"}`);

  if (requestIntentString === "alooha_stats") {
    let historyStats = new HistoryStats();
    let statsData = await historyStats.getModelCounts();
    return res.status(200).json({message: statsData});
  }

  if (requestIntentString === "question") {
    questionAnatomy = metricWorks.getAnatomy(req.body.toString(), req);
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
        // const chunkString = chunk.toString();
        // const chunkString = JSON.stringify(chunk, null, 2);
        // const chunkString = JSON.stringify(chunk.toString(), null, 2);
        // const chunkString = chunk.toString("utf8");

        const chunkString = chunk.toString("utf8");
        const parsedJson = JSON.parse(chunkString);
        const prettyJson = JSON.stringify(parsedJson, null, 2);

        logWritter.log("--------- raw chunk ---------");
        logWritter.log(prettyJson);
        logWritter.log("--------- end of raw chunk ---------");
        
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