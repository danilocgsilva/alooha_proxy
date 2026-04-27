# Alooha server

A proxy to be in front of Ollama server, but capturing answer metrics and performance.

## Usage

1. Copy `.env.example` to `.env`, and change the port if required.
1. Compile the TypeScript.
2. Run `dist/server.js`

The default address to access this server is http://localhost:11001, then make resquests with the same anatomy that you usually do when acessing Ollama.

## Developing

I am using VS Codium as a primary development IDE tool.

It works in a very similar way as Visual Studio Code, though.

Acessing the base project through Codium, you are invited to build and develop inside Docker, which is always a good idea. If not, just type F1 and search for command to build inside container.

The code ships with .`vscode/lauch.json` file, which was already tested successfuly as a recipe for debugging. If is the case, you MAY NOT build and start server through expected npm tools. Insead, just start the debugging, and the application will automatically build and start a server. So, when you build the environment, you may not automate the build nor the server building. You must start it manually.

