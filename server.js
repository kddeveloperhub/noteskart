const express = require("express");
const Razorpay = require("razorpay");
const cors = require("cors");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const admin = require("firebase-admin");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

/* ==============================
   🔐 FIREBASE ADMIN SETUP
============================== */

const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

/* ==============================
   💳 RAZORPAY SETUP
============================== */

const razorpay = new Razorpay({
  key_id: process.env.KEY_ID,
  key_secret: process.env.KEY_SECRET,
});

/* ==============================
   🔹 CREATE ORDER
============================== */

app.post("/create-order", async (req, res) => {
  try {
    const options = {
      amount: 100 * 100, // ₹100 in paise
      currency: "INR",
      receipt: "receipt_" + Date.now(),
    };

    const order = await razorpay.orders.create(options);
    res.json(order);
  } catch (error) {
    console.error("Order creation error:", error);
    res.status(500).json({ error: "Order creation failed" });
  }
});

/* ==============================
   🔹 VERIFY PAYMENT
============================== */

app.post("/verify-payment", (req, res) => {
  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  } = req.body;

  const body = razorpay_order_id + "|" + razorpay_payment_id;

  const expectedSignature = crypto
    .createHmac("sha256", process.env.KEY_SECRET)
    .update(body)
    .digest("hex");

  if (expectedSignature === razorpay_signature) {
    res.json({ success: true });
  } else {
    res.status(400).json({ success: false });
  }
});

/* ==============================
   🔒 SECURE NOTE ACCESS
============================== */

app.get("/get-note/:filename/:uid", async (req, res) => {
  const { filename, uid } = req.params;

  try {
    // 🔍 Check user in Firestore
    const userDoc = await db.collection("users").doc(uid).get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!userDoc.data().isPaid) {
      return res.status(403).json({ error: "Access denied. Payment required." });
    }

    // 📁 Construct file path
    const filePath = path.join(__dirname, "notes", filename);

    // 🔎 Check file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found" });
    }

    // 🔐 Send file
    res.sendFile(filePath);
  } catch (error) {
    console.error("File access error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

/* ==============================
   🚀 START SERVER
============================== */

app.listen(5000, () => {
  console.log("🚀 Server running on port 5000");
});
