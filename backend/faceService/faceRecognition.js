const axios = require("axios");
const fs = require("fs");
const FormData = require("form-data");

// 🔥 Your CompreFace config
const API_KEY = "1d009424-fc3e-456e-befb-4d2b348b787a";
const URL = "http://localhost:8001/api/v1/recognition/recognize";

async function recognizeFace(imagePath) {
  try {
    const form = new FormData();

    form.append("file", fs.createReadStream(imagePath));

    const response = await axios.post(URL, form, {
      headers: {
        ...form.getHeaders(),
        "x-api-key": API_KEY,
      },
    });

    return response.data;

  } catch (err) {
    console.error("❌ CompreFace error:", err.response?.data || err.message);
    return null;
  }
}

module.exports = { recognizeFace };