There is a taskfile to help with operational tasks, see https://taskfile.dev/ for more information.

First, install go-task:
`brew install go-task`

* list all available tasks `task -l`

## Frontend

* build frontend: `task frontend:build`
* build with the custom api url: `REACT_APP_API_URL=https://example.local task frontend:build`

* build frontend via docker image: `task frontend:docker-build`
* build frontend via docker image with the custom api url: `REACT_APP_API_URL=https://example.local task frontend:docker-build`

* copy frontend files to s3 bucket: `S3BUCKET=myawesomebucket task frontend:deploy-s3`

## Backend

* run tests: `task backend:test`
* build latest: `task backend:build`
* build a specific tag: `IMAGE_NAME=ghcr.io/myawesomeuser/vacal IMAGE_TAG=1.0.0 task backend:build`
