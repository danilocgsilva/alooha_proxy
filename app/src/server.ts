import express from "express";
import { request } from "undici";
import type QuestionAnatomy from "./types/QuestionAnatomy.js";
import MetricWorks from "./server_domain/MetricWorks.js";
import MetricLifeCycle from "./server_domain/MetricLifeCycle.js";
import RequestIntent from "./server_domain/RequestIntent.js";
import LogConsole from "./server_domain/LogConsole.js";
import { AppDataSource } from "./database/dataSource.js";
import QuestionProcessingHelper from "./server_domain/QuestionProcessingHelper.js";
import { v4 as uuidv4 } from 'uuid';

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
  const formatter = QuestionProcessingHelper.getFormatter();
  const formatterMilliseconds = QuestionProcessingHelper.getFormatterMilliseconds();
  let uuid: string;

  if (requestIntentString === "question") {
    questionAnatomy = MetricWorks.getAnatomy(req.body.toString(), req);
    metricLifeCycle.setWhenBegan();
    metricLifeCycle.setUserIp(req);
    logWritter.log(`I got your question: ${questionAnatomy.question}`);
    uuid = uuidv4();
    logWritter.log(`Uuid: ${uuid}`);
    logWritter.log(`Model choosed: ${questionAnatomy.model}`);
    
    const date = new Date();
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

      headersTimeout: 1000 * 60 * 3 * 10,
      bodyTimeout: 1000 * 60 * 3 * 10,
    });

    res.status(statusCode);

    QuestionProcessingHelper.assemblyHeader(res, upstreamHeaders);

    let totalBytes = 0;
    let totalChunks = 0;

    body.on("data", (chunk: Buffer) => {
      totalBytes += chunk.length;
      if (requestIntentString === "question") {
        totalChunks++;
        const chunksResponse = metricLifeCycle.digestChunk(chunk);
        logWritter.log(`-> chunk: ${uuid}, ${formatterMilliseconds.format(new Date())} <-`);
        logWritter.log(`--->${chunksResponse}<---`);
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