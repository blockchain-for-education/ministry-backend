const express = require("express");
const router = express.Router();
const connection = require("../../db");
const VOTE_REQUEST = "VoteRequest";
const { authen } = require("../user-mng/protect-middleware");
const axios = require("axios").default;

router.get("/vote-requests", authen, async (req, res) => {
  try {
    const col = (await connection).db().collection(VOTE_REQUEST);
    const state = req.query.state;
    let votes;
    if (state === "new") {
      votes = await col.find({ state: "new" }).toArray();
    } else if (state === "old") {
      votes = await col.find({ state: { $in: ["accepted", "declined"] } }).toArray();
    } else {
      votes = await col.find({}).toArray();
    }
    res.json(votes);
  } catch (error) {
    res.status(500).send(error);
  }
});

router.post("/vote", authen, async (req, res) => {
  try {
    const decision = req.body.decision;
    const publicKeyOfRequest = req.body.publicKeyOfRequest;
    const privateKeyHex = req.body.privateKeyHex;
    if (!decision || !publicKeyOfRequest || !privateKeyHex) {
      return res.status(400).json({ ok: false, msg: "decision, publicKeyOfRequest, privateKeyHex is require!" });
    }
    let opResult;

    if (decision !== "accept" && decision != "decline") {
      return res.status(400).json({ ok: false, msg: "decision == accept || decision == decline!" });
    } else if (decision === "accept") {
      opResult = await sendAcceptVote(publicKeyOfRequest, privateKeyHex);
    } else if (decision === "decline") {
      opResult = await sendDeclineVote(publicKeyOfRequest, privateKeyHex);
    }

    if (opResult.ok) {
      const col = (await connection).db().collection(VOTE_REQUEST);
      const updateResult = await col.updateOne(
        { publicKey: publicKeyOfRequest },
        {
          $set: {
            state: decision === "accept" ? "accepted" : "declined",
            date: new Date().toISOString().split("T")[0],
            txid: opResult.transactionId,
          },
        }
      );
      res.json(updateResult);
    } else {
      res.status(500).json(opResult);
    }
  } catch (error) {
    res.status(500).send(error);
  }
});

async function sendAcceptVote(publicKeyOfRequest, privateKeyHex) {
  const res = await axios.post("/create_vote", { publicKeyOfRequest, privateKeyHex, decision: "accept" });
  return res.data;
}

async function sendDeclineVote(publicKeyOfRequest, privateKeyHex) {
  const res = await axios.post("/create_vote", { publicKeyOfRequest, privateKeyHex, decision: "decline" });
  return res.data;
}

module.exports = router;
