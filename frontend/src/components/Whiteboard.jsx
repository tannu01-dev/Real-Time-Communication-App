import { useEffect, useRef, useState } from "react";
import socket from "../services/socket";

const Whiteboard = ({ meetingId, onClose }) => {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef(null);

  const [color, setColor] = useState("#000000");
  const [lineWidth, setLineWidth] = useState(3);

  // ==========================================
  // CANVAS SETUP
  // ==========================================

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    const resizeCanvas = () => {
      const rect =
        canvas.getBoundingClientRect();

      const oldCanvas =
        document.createElement("canvas");

      oldCanvas.width = canvas.width;
      oldCanvas.height = canvas.height;

      oldCanvas
        .getContext("2d")
        .drawImage(canvas, 0, 0);

      canvas.width = rect.width;
      canvas.height = rect.height;

      const ctx = canvas.getContext("2d");

      ctx.drawImage(
        oldCanvas,
        0,
        0,
        oldCanvas.width,
        oldCanvas.height,
        0,
        0,
        canvas.width,
        canvas.height
      );
    };

    resizeCanvas();

    window.addEventListener(
      "resize",
      resizeCanvas
    );

    return () => {
      window.removeEventListener(
        "resize",
        resizeCanvas
      );
    };
  }, []);

  // ==========================================
  // DRAW LINE
  // ==========================================

  const drawLine = (
    from,
    to,
    lineColor,
    width,
    emit = true
  ) => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    const ctx =
      canvas.getContext("2d");

    ctx.beginPath();

    ctx.moveTo(
      from.x,
      from.y
    );

    ctx.lineTo(
      to.x,
      to.y
    );

    ctx.strokeStyle =
      lineColor;

    ctx.lineWidth = width;

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.stroke();

    ctx.closePath();

    if (emit) {
      socket.emit(
        "whiteboard-draw",
        {
          meetingId,
          from,
          to,
          color: lineColor,
          lineWidth: width,
        }
      );
    }
  };

  // ==========================================
  // MOUSE DOWN
  // ==========================================

  const handleMouseDown = (e) => {
    drawingRef.current = true;

    const rect =
      canvasRef.current.getBoundingClientRect();

    lastPointRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  // ==========================================
  // MOUSE MOVE
  // ==========================================

  const handleMouseMove = (e) => {
    if (!drawingRef.current) {
      return;
    }

    const rect =
      canvasRef.current.getBoundingClientRect();

    const currentPoint = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };

    if (!lastPointRef.current) {
      lastPointRef.current =
        currentPoint;

      return;
    }

    drawLine(
      lastPointRef.current,
      currentPoint,
      color,
      lineWidth,
      true
    );

    lastPointRef.current =
      currentPoint;
  };

  // ==========================================
  // MOUSE UP
  // ==========================================

  const stopDrawing = () => {
    drawingRef.current = false;

    lastPointRef.current = null;
  };

  // ==========================================
  // RECEIVE DRAW
  // ==========================================

  useEffect(() => {
    const handleRemoteDraw = (data) => {
      drawLine(
        data.from,
        data.to,
        data.color,
        data.lineWidth,
        false
      );
    };

    socket.on(
      "whiteboard-draw",
      handleRemoteDraw
    );

    return () => {
      socket.off(
        "whiteboard-draw",
        handleRemoteDraw
      );
    };
  }, []);

  // ==========================================
  // CLEAR BOARD
  // ==========================================

  const clearBoard = () => {
    const canvas =
      canvasRef.current;

    if (!canvas) return;

    const ctx =
      canvas.getContext("2d");

    ctx.clearRect(
      0,
      0,
      canvas.width,
      canvas.height
    );

    socket.emit(
      "whiteboard-clear",
      {
        meetingId,
      }
    );
  };

  // ==========================================
  // RECEIVE CLEAR
  // ==========================================

  useEffect(() => {
    const handleRemoteClear = () => {
      const canvas =
        canvasRef.current;

      if (!canvas) return;

      const ctx =
        canvas.getContext("2d");

      ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
      );
    };

    socket.on(
      "whiteboard-clear",
      handleRemoteClear
    );

    return () => {
      socket.off(
        "whiteboard-clear",
        handleRemoteClear
      );
    };
  }, []);

  return (
    <div className="whiteboard-overlay">

      {/* =====================================
          HEADER
      ===================================== */}

      <div className="whiteboard-header">

        <div>
          <h2>Whiteboard</h2>

          <span>
            Draw and collaborate
            in real-time
          </span>
        </div>

        <button
          onClick={onClose}
          className="whiteboard-close"
        >
          ✕
        </button>

      </div>

      {/* =====================================
          TOOLS
      ===================================== */}

      <div className="whiteboard-toolbar">

        <label>
          Color
        </label>

        <input
          type="color"
          value={color}
          onChange={(e) =>
            setColor(e.target.value)
          }
        />

        <label>
          Size
        </label>

        <input
          type="range"
          min="1"
          max="20"
          value={lineWidth}
          onChange={(e) =>
            setLineWidth(
              Number(e.target.value)
            )
          }
        />

        <button
          onClick={clearBoard}
          className="clear-board-btn"
        >
          🗑 Clear
        </button>

      </div>

      {/* =====================================
          CANVAS
      ===================================== */}

      <div className="whiteboard-canvas-wrapper">

        <canvas
          ref={canvasRef}
          onMouseDown={
            handleMouseDown
          }
          onMouseMove={
            handleMouseMove
          }
          onMouseUp={
            stopDrawing
          }
          onMouseLeave={
            stopDrawing
          }
        />

      </div>

    </div>
  );
};

export default Whiteboard;

