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
* For USERNAME/PASSWORD AUTHENTICATION generate a string like this run: `openssl rand -hex 32` and set `AUTHENTICATION_SECRET_KEY` in the environment.
* Create an initial user with the `/users/create-initial` method which can be reached through `/docs` URL.
