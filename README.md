# BBB manual synchronization

## Why we need it?
This Node.js project is to synchronize all bicycles that are currently missing or containing un-matched information between BBB's SQL Server and MongoDB.

## How to use it?
Ensure you've already installed Node.js and `yarn` in your host and install all dependencies before we can run some scripts:
```sh
yarn install
```

Create a file to store all necessary environment variables, named `.env` following the structure (of course, the values are all reducted for example):
```.env
ENV=
MSSQL_HOST=
MSSQL_PORT=
MSSQL_USER=
MSSQL_PASSWORD=
MSSQL_DATABASE=
MONGO_HOST=
MONGO_PORT=
MONGO_USER=
MONGO_PASSWORD=
MONGO_DATABASE=
BBB_ML_BASE_URL=
BBB_ML_SECRET_HEADER=
BBB_ML_SECRET_HEADER_VALUE=
```

At this moment, there's only a script for synchronizing bicycle stuff, run it by using:
```sh
yarn sync
```

## And...
Use it at your own risk, and don't forget to contribute to make it more suitable to the business requirements' changes.