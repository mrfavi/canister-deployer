const express = require("express");
const bodyParser = require("body-parser");
const { exec } = require("child_process");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.post("/deploy", (req, res) => {
  // Extracting data from the request body
  let {
    principalId,
    logoType,
    logoData,
    name,
    symbol,
    maxLimit,
    startDateTime,
    endDateTime,
    location,
    price,
    isInPerson,
    isFree,
    description,
  } = req.body;
  const canisterName = name.replace(/\s+/g, "_").toLowerCase();
  // Split the name into an array of words
  // Ensure that the name is a string and has at least three characters
  if (typeof name !== "string" || name.length < 3) {
    return (name = name.replace(/\s+/g, "_"));
  }

  // Take the first three characters of the name string and convert them to uppercase
  const firstThreeChars = name.substring(0, 3).toUpperCase();

  // Update dfx.json with the new canister
  const dfxJsonPath = path.join(__dirname, "../favourse-icp-backend/dfx.json"); // Update this path as needed
  fs.readFile(dfxJsonPath, "utf8", (err, data) => {
    if (err) {
      return res.status(500).send("Error reading dfx.json");
    }

    let dfxConfig;
    try {
      dfxConfig = JSON.parse(data);
    } catch (parseErr) {
      return res.status(500).send("Error parsing dfx.json");
    }

    console.log("Received name:", canisterName);

    if (typeof canisterName !== "string" || name.trim() === "") {
      return res
        .status(400)
        .send("Canister name is not provided or is not a valid string.");
    }

    // Replace spaces with underscores and convert to lowercase
    dfxConfig.canisters[canisterName] = { main: "src/Main.mo" };

    console.log("Attempting to write to dfx.json with the following config:");
    console.log(JSON.stringify(dfxConfig, null, 2));

    fs.writeFile(
      dfxJsonPath,
      JSON.stringify(dfxConfig, null, 2),
      "utf8",
      (writeErr) => {
        if (writeErr) {
          console.error(`Error writing to dfx.json: ${writeErr}`);
          return res.status(500).send("Error writing to dfx.json");
        }

        console.log("dfx.json was updated successfully.");

        // Construct the deployment argument
        // const deployArgument = `"(principal\\\"${principalId}\\\", record { logo = record { logo_type = \\\"${logoType}\\\"; data = \\\"${logoData}\\\"; }; name = \\\"${name}\\\"; symbol = \\\"${firstThreeChars}\\\"; maxLimit = ${maxLimit}; })"`;
        const deployArgument = `"(principal\\\"${principalId}\\\", record {
            logo = record {
              logo_type = \\\"${logoType}\\\"; 
              data = \\\"${logoData}\\\"; 
            }; 
            name = \\\"${name}\\\"; 
            symbol = \\\"${firstThreeChars}\\\"; 
            maxLimit = ${maxLimit}; 
            startDateTime = \\\"${startDateTime}\\\"; 
            endDateTime = \\\"${endDateTime}\\\"; 
            location = \\\"${location}\\\"; 
            description = \\\"${description}\\\"; 
            price = ${price}; 
            isInPerson = ${isInPerson}; 
            isFree = ${isFree};
          })"`;

        // Now deploy the new canister
        const deployCommand = `dfx deploy --argument ${deployArgument} ${canisterName}`;
        const getCanisterIdCommand = `dfx canister id ${canisterName}`;

        exec(
          deployCommand,
          { cwd: "../favourse-icp-backend", maxBuffer: 1024 * 500 },
          (deployError, deployStdout, deployStderr) => {
            if (deployError) {
              console.error(`exec error: ${deployError}`);
              return res
                .status(500)
                .json({ error: `Deployment failed: ${deployStderr}` });
            }

            // Regex to match the URL line
            const urlRegex = /canisterId=([^\s]+)/;
            const urlMatch = deployStdout.match(urlRegex);
            let canisterUrl = "";
            if (urlMatch && urlMatch.length > 1) {
              canisterUrl = urlMatch[0]; // Capturing the full URL from the stdout
            }

            if (canisterUrl) {
              // If we successfully captured the URL, return it
              res.json({
                message: "Deployment successful.",
                deployOutput: deployStdout,
                canisterUrl: canisterUrl, // Returning the full URL
              });
            } else {
              // If we did not find the URL, we assume the canister ID needs to be retrieved separately
              exec(
                getCanisterIdCommand,
                { cwd: "../favourse-icp-backend" },
                (idError, idStdout, idStderr) => {
                  if (idError) {
                    console.error(`exec error: ${idError}`);
                    return res.status(500).json({
                      error: `Failed to get canister ID: ${idStderr}`,
                    });
                  }

                  // Extract the canister ID from the getCanisterIdCommand output
                  const canisterId = idStdout.trim(); // Assuming the output is just the canister ID

                  res.json({
                    message: "Deployment Successful",
                    deployOutput: deployStdout,
                    canisterId: canisterId,
                    principalId: principalId,
                    logoType: logoType,
                    logoData: logoData,
                    symbol: firstThreeChars,
                    canisterName: canisterName, // This will now contain the canister ID
                  });
                }
              );
            }
          }
        );
      }
    );
  });
});

const PORT = process.env.PORT || 3040;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
