#!/bin/bash

docker compose up alooha_proxy_db -d --build 
docker compose up alooha_proxy_pgadmin -d --build
docker compose up alooha_proxy -d --build
