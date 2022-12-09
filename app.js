const express = require("express");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const app = express();
app.use(express.json());
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();

app.post("/register/", async (request, response) => {
  const { username, name, password, gender, location } = request.body;
  const hashedPassword = await bcrypt.hash(request.body.password, 10);
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);

  if (dbUser === undefined) {
    if (password.length < 5) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const createUserQuery = `
      INSERT INTO 
        user (username, name, password, gender, location) 
      VALUES 
        (
          '${username}', 
          '${name}',
          '${hashedPassword}', 
          '${gender}',
          '${location}'
        )`;
      const dbResponse = await db.run(createUserQuery);
      response.status(200);
      response.send("User created successfully");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

app.post("/login/", async (req, res) => {
  const { username, password } = req.body;
  const Query = `SELECT * FROM user WHERE username ='${username}';`;
  const loginQueryid = await db.get(Query);
  if (loginQueryid === undefined) {
    res.status(400);
    res.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(
      password,
      loginQueryid.password
    );
    if (isPasswordMatched == true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      res.send({ jwtToken });
    } else {
      res.status(400);
      res.send("Invalid password");
    }
  }
});

app.get("/states/", authenticateToken, async (req, res) => {
  const Query = `SELECT state_id as stateId, state_name as stateName,
  population FROM state;`;
  const dbresult = await db.all(Query);
  res.send(dbresult);
});

app.get("/states/:stateId/", authenticateToken, async (req, res) => {
  const stateId = req.params;
  console.log(stateId);
  const Query = `SELECT state_id as stateId,state_name as stateName
  ,population FROM state WHERE state_id = '${stateId.stateId}';`;
  const dbresult = await db.get(Query);
  res.send(dbresult);
});

app.post("/districts/", authenticateToken, async (req, res) => {
  const { districtName, stateId, cases, cured, active, deaths } = req.body;
  const Query = `INSERT INTO district(district_name,state_id,cases,cured
    ,active,deaths) VALUES('${districtName}',${stateId},${cases},${cured},${active},${deaths});`;
  //console.log(req.body);

  // const Q = `SELECT * FROM district;`;
  const r = await db.run(Query);

  res.send("District Successfully Added");
});

app.get("/districts/:districtId/", authenticateToken, async (req, res) => {
  const districtId = req.params;
  const Query = `SELECT district_id as districtId,district_name as districtName,
  state_id as stateId,cases,cured,active,deaths FROM district WHERE district_id = ${districtId.districtId};`;
  const dbresult = await db.get(Query);
  res.send(dbresult);
});

app.put("/districts/:districtId/", authenticateToken, async (req, res) => {
  const districtId = req.params;
  const { districtName, stateId, cases, cured, active, deaths } = req.body;
  const Query = `UPDATE  district SET district_name = '${districtName}' ,state_id=${stateId},cases=${cases},cured=${cured}
    ,active=${active},deaths=${deaths} WHERE district_id = ${districtId.districtId};`;
  //console.log(req.body);

  // const Q = `SELECT * FROM district;`;
  const r = await db.run(Query);

  res.send("District Details Updated");
});
const k = {
  totalCases: 724355,
  totalCured: 615324,
  totalActive: 99254,
  totalDeaths: 9777,
};
app.get("/states/:stateId/stats/", authenticateToken, async (req, res) => {
  const stateId = req.params;
  const Query = `SELECT sum(district.cases) as totalCases,sum(district.cured) as totalCured,sum(district.active) as totalActive
  ,sum(district.deaths) as totalDeaths FROM district LEFT JOIN state ON district.state_id = state.state_id  WHERE district.state_id = '${stateId.stateId}';`;
  const dbresult = await db.all(Query);
  res.send(dbresult);
});

module.exports = app;

app.delete("/districts/:districtId/", authenticateToken, async (req, res) => {
  const districtId = req.params;
  const Query = `DELETE FROM district WHERE district_id = ${districtId.districtId};`;
  const dbresult = await db.run(Query);
  res.send("District Removed");
});
