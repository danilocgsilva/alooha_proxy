# Alooha server

A proxy to be in front of Ollama server, but capturing answer metrics and performance.

You access the endpoint served by this project exactly you do in Ollama. But this one intercepts all requests and takes oportunity to log statistics and response performance.

## Usage

1. Copy `.env.example` to `.env`, and change the port if required.
1. Compile the TypeScript.
2. Run `dist/server.js`

The default address to access this server is http://localhost:11001, then make resquests with the same anatomy that you usually do when acessing Ollama.

## What do you have here?

Look to the `docker-compose.yml` file to see all services from this project. You have the following:

* alooha_proxy: the main application server.
* alooha_proxy_db: database to which the server connects and save the history of questions, answers and its performance.
* alooha_proxy_pgadmin: actually you don't need it to make it work. It is just a convenience application for development, that is the PgAdmin. This appplications allow you to navigate more easily to the database, without depending upon a database client.

## Developing

I am trying to use VS Codium as a primary development IDE tool.

It works in a very similar way as Visual Studio Code, though.

Acessing the base project through Codium, you are invited to build and develop inside Docker, which is always a good idea. If not, just type F1 and search for command to build inside container.

The code ships with .`vscode/lauch.json` file, which was already tested successfuly as a recipe for debugging. If is the case, you MAY NOT build and start server through expected npm tools. Insead, just start the debugging, and the application will automatically build and start a server. So, when you build the environment, you may not automate the build nor the server building. You must start it manually.

Sometimes the container development fails in the VS Codium. In this case, you can go to VS Code (unfortunatelly) to use the container development working as you expects.

**NOTE**: Database permission error on the server startup

Sometimes, when starting the web server, you might get an error like this:

```
error: could not open file "global/pg_filenode.map": Permission denied
```

When it happens, just fix permission in the host machine:

```
sudo chown -R 999:999 ./alooha_proxy_db_data
```

Or in a more robust way, more distro agnostic:
```
sudo chown -R $(id -u postgres 2>/dev/null || echo 999):$(id -g postgres 2>/dev/null || echo 999) ./alooha_proxy_db_data 
```

