docker-compose up --build --abort-on-container-exit --exit-code-from pytest --remove-orphans pytest
docker-compose down --volumes --remove-orphans