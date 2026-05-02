import express from "express";
import { request } from "undici";
import type QuestionAnatomy from "./types/QuestionAnatomy.js";
import MetricWorks from "./MetricWorks.js";
import MetricLifeCycle from "./MetricLifeCycle.js";
import RequestIntent from "./RequestIntent.js";
import LogConsole from "./LogConsole.js";
import { AppDataSource } from "./database/dataSource.js";
import QuestionProcessingHelper from "./QuestionProcessingHelper.js";

const app = express();

app.use(express.raw({ type: "*/*" }));

const OLLAMA_URL = `http://host.docker.internal:${process.env.OLLAMA_PORT ?? "11434"}`;

app.all(/.*/, async (req: express.Request, res: express.Response) => {
  const logWritter = new LogConsole();
  const targetUrl = `${OLLAMA_URL}${req.originalUrl}`;
  const metricLifeCycle = new MetricLifeCycle();
  let questionAnatomy: QuestionAnatomy | null = null;
  const requestIntent: RequestIntent = new RequestIntent(req);
  const requestIntentString = requestIntent.getIntent();
  if (requestIntentString === "question") {
    questionAnatomy = MetricWorks.getAnatomy(req.body.toString(), req);
    metricLifeCycle.setWhenBegan();
    metricLifeCycle.setUserIp(req);
    logWritter.log(`I got your question: ${questionAnatomy.question}`);
    logWritter.log(`Model choosed: ${questionAnatomy.model}`);

    const date = new Date();

    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Sao_Paulo", // change to your target timezone
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    logWritter.log(`Your question got -> ${questionAnatomy.question.length} <- characters.`);
    logWritter.log(`===> ${formatter.format(date)}`);
  }

  try {
    const headers = { ...req.headers };

    delete headers.host;
    delete headers["content-length"];
    delete headers.connection;

    const { body, statusCode, headers: upstreamHeaders } = await request(targetUrl, {
      method: req.method,
      headers,
      body: req.body && req.body.length ? req.body : undefined,

      headersTimeout: 1000 * 60 * 10, // 10 minutes
      bodyTimeout: 1000 * 60 * 10,    // optional: time between body chunks
    });

    res.status(statusCode);

    QuestionProcessingHelper.assemblyHeader(res, upstreamHeaders);

    let totalBytes = 0;
    let totalChunks = 0;

    body.on("data", (chunk: Buffer) => {
      totalBytes += chunk.length;
      totalChunks++;
      if (requestIntentString === "question") {
        const chunksResponse = metricLifeCycle.digestChunk(chunk);
        logWritter.log(`-> ${chunksResponse}`);
      }
    });

    body.on("error", (err) => {
      console.error("Stream error:", err);
      res.destroy(err);
    });

    res.on("close", () => {
      body.destroy();
    });

    body.pipe(res);

    body.on("end", () => {
      logWritter.log("===> End event reached <===");
      logWritter.log(`Intent: ${requestIntentString}`);

      if (requestIntentString === "question") {
        QuestionProcessingHelper.finishQuestion(
          metricLifeCycle, 
          questionAnatomy, 
          totalBytes, 
          totalChunks, 
          logWritter
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