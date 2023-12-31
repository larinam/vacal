# vacal - Vacation Calendar

A modern tool to manage calendar scheduling business processes.

* Manage teams and team members.
* Manage vacation days.
* Visualize vacation days, weekends and public holidays.

## Technologies
* Uses Python [FastAPI](https://github.com/tiangolo/fastapi) on the backend and [MongoDB](https://github.com/mongodb/mongo) as a storage.
* [ReactJS](https://github.com/facebook/react) on the frontend.

## Screenshot
![Screenshot.png](Screenshot.png)

## Run locally with only one command (Docker Compose)
* `./run_docker_compose_local.sh`
* Access on http://localhost:3000

## Production deployment
### MongoDB
* Deploy or use existing MongoDB server with enabled authentication. 
### Backend
* Use prebuilt Docker container from this repository [packages](https://github.com/larinam/vacal/pkgs/container/vacal).
* Provide to container relevant environment variables defined in [`backend/.env.template`](https://github.com/larinam/vacal/blob/main/backend/.env.template). 
### Frontend
* Create `.env.production.local` from [`frontend/.env.example`](https://github.com/larinam/vacal/blob/main/frontend/.env.example). 
* Build with `npm run build`. 
* Use built static sources from the `build` folder.
### Authentication
* The backend can optionally be protected with the Basic Authentication.
* In this case the `REACT_APP_REQUIRE_BASIC_AUTH` env variable in `.env.production.local` should be set to `true`.
