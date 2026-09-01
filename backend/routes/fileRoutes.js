const express = require("express");
const router = express.Router();

const upload = require("../middleware/upload");

router.post(
  "/upload",
  upload.single("file"),
  (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No file uploaded",
        });
      }

      res.status(200).json({
        success: true,
        message: "File uploaded successfully",
        file: {
          originalName:
            req.file.originalname,

          fileName:
            req.file.filename,

          size:
            req.file.size,

          url:
            `/uploads/${req.file.filename}`,
        },
      });
    } catch (error) {
      console.error(
        "FILE UPLOAD ERROR:",
        error
      );

      res.status(500).json({
        success: false,
        message: "File upload failed",
      });
    }
  }
);

module.exports = router;