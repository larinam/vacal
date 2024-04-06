# vacal - Vacation Calendar

A modern tool for managing calendar-based scheduling processes.

* Manage teams and team members effectively.
* Organize and track vacation days.
* Visualize vacation days, weekends, and public holidays in an intuitive interface.
* Ideal for both local and distributed teams, enhancing team coordination and planning.

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
#### User/Password authentication
* For USERNAME/PASSWORD AUTHENTICATION generate a string like this run: `openssl rand -hex 32` and set `AUTHENTICATION_SECRET_KEY` in the environment.
#### Telegram authentication
* See https://core.telegram.org/widgets/login
* Configure TELEGRAM_BOT_TOKEN in the backend .env
* Tip for local testing: https://stackoverflow.com/questions/61964889/testing-telegram-login-widget-locally