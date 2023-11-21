const express = require("express");
const bodyParser = require("body-parser");
const { exec } = require("child_process");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.post("/deploy", (req, res) => {
  // Extracting data from the request body
  const { principalId, logoType, logoData, name, symbol, maxLimit } = req.body;

  // Construct the deployment argument
  const deployArgument = `"(principal\\\"${principalId}\\\", record { logo = record { logo_type = \\\"${logoType}\\\"; data = \\\"${logoData}\\\"; }; name = \\\"${name}\\\"; symbol = \\\"${symbol}\\\"; maxLimit = ${maxLimit}; })"`;

  const deployCommand = `dfx deploy --argument ${deployArgument} dip721_nft_container`;
  const getCanisterIdCommand = `dfx canister id dip721_nft_container`;

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
              return res
                .status(500)
                .json({ error: `Failed to get canister ID: ${idStderr}` });
            }

            // Extract the canister ID from the getCanisterIdCommand output
            const canisterId = idStdout.trim(); // Assuming the output is just the canister ID

            res.json({
              message:
                "Deployment successful, but needed to retrieve canister ID separately.",
              deployOutput: deployStdout,
              canisterId: canisterId, // This will now contain the canister ID
            });
          }
        );
      }
    }
  );
});

const PORT = process.env.PORT || 3040;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
