import { useEffect, useRef, useState } from "react";
import socket from "../services/socket";

const Whiteboard = ({ meetingId, onClose }) => {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef(null);

  const [color, setColor] = useState("#000000");
  const [lineWidth, setLineWidth] = useState(3);

  // =====================================================
  // CANVAS
  // =====================================================

  const setupCanvas = () => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    const wrapper =
      canvas.parentElement;

    const rect =
      wrapper.getBoundingClientRect();

    const dpr =
      window.devicePixelRatio || 1;

    const oldCanvas =
      document.createElement("canvas");

    oldCanvas.width =
      canvas.width;

    oldCanvas.height =
      canvas.height;

    if (
      canvas.width &&
      canvas.height
    ) {
      oldCanvas
        .getContext("2d")
        .drawImage(
          canvas,
          0,
          0
        );
    }

    canvas.width =
      rect.width * dpr;

    canvas.height =
      rect.height * dpr;

    canvas.style.width =
      `${rect.width}px`;

    canvas.style.height =
      `${rect.height}px`;

    const ctx =
      canvas.getContext("2d");

    ctx.setTransform(
      dpr,
      0,
      0,
      dpr,
      0,
      0
    );

    if (
      oldCanvas.width &&
      oldCanvas.height
    ) {
      ctx.drawImage(
        oldCanvas,
        0,
        0,
        oldCanvas.width,
        oldCanvas.height,
        0,
        0,
        rect.width,
        rect.height
      );
    }
  };

  useEffect(() => {
    setupCanvas();

    window.addEventListener(
      "resize",
      setupCanvas
    );

    return () => {
      window.removeEventListener(
        "resize",
        setupCanvas
      );
    };
  }, []);

  // =====================================================
  // GET NORMALIZED POINT
  // =====================================================

  const getPoint = (e) => {
    const canvas =
      canvasRef.current;

    const rect =
      canvas.getBoundingClientRect();

    return {
      x:
        (e.clientX - rect.left) /
        rect.width,

      y:
        (e.clientY - rect.top) /
        rect.height,
    };
  };

  // =====================================================
  // DRAW
  // =====================================================

  const drawLine = (
    from,
    to,
    lineColor,
    width,
    emit = true
  ) => {
    const canvas =
      canvasRef.current;

    if (!canvas) return;

    const rect =
      canvas.getBoundingClientRect();

    const ctx =
      canvas.getContext("2d");

    const fromX =
      from.x * rect.width;

    const fromY =
      from.y * rect.height;

    const toX =
      to.x * rect.width;

    const toY =
      to.y * rect.height;

    ctx.beginPath();

    ctx.moveTo(
      fromX,
      fromY
    );

    ctx.lineTo(
      toX,
      toY
    );

    ctx.strokeStyle =
      lineColor;

    ctx.lineWidth =
      width;

    ctx.lineCap =
      "round";

    ctx.lineJoin =
      "round";

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

  // =====================================================
  // START DRAWING
  // =====================================================

  const handlePointerDown = (
    e
  ) => {
    e.preventDefault();

    drawingRef.current = true;

    lastPointRef.current =
      getPoint(e);

    canvasRef.current?.setPointerCapture?.(
      e.pointerId
    );
  };

  // =====================================================
  // DRAWING
  // =====================================================

  const handlePointerMove = (
    e
  ) => {
    if (!drawingRef.current) {
      return;
    }

    e.preventDefault();

    const currentPoint =
      getPoint(e);

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

  // =====================================================
  // STOP
  // =====================================================

  const stopDrawing = () => {
    drawingRef.current = false;
    lastPointRef.current = null;
  };

  // =====================================================
  // RECEIVE DRAW
  // =====================================================

  useEffect(() => {
    const handleRemoteDraw = (
      data
    ) => {
      if (
        data?.meetingId?.toString() !==
        meetingId?.toString()
      ) {
        return;
      }

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
  }, [meetingId]);

  // =====================================================
  // CLEAR
  // =====================================================

  const clearBoard = () => {
    const canvas =
      canvasRef.current;

    if (!canvas) return;

    const ctx =
      canvas.getContext("2d");

    const rect =
      canvas.getBoundingClientRect();

    ctx.clearRect(
      0,
      0,
      rect.width,
      rect.height
    );

    socket.emit(
      "whiteboard-clear",
      {
        meetingId,
      }
    );
  };

  // =====================================================
  // RECEIVE CLEAR
  // =====================================================

  useEffect(() => {
    const handleRemoteClear = (
      data
    ) => {
      if (
        data?.meetingId?.toString() !==
        meetingId?.toString()
      ) {
        return;
      }

      const canvas =
        canvasRef.current;

      if (!canvas) return;

      const ctx =
        canvas.getContext("2d");

      const rect =
        canvas.getBoundingClientRect();

      ctx.clearRect(
        0,
        0,
        rect.width,
        rect.height
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
  }, [meetingId]);

  return (
    <div className="whiteboard-overlay">

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

      <div className="whiteboard-toolbar">

        <label>
          Color
        </label>

        <input
          type="color"
          value={color}
          onChange={(e) =>
            setColor(
              e.target.value
            )
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

      <div className="whiteboard-canvas-wrapper">

        <canvas
          ref={canvasRef}
          onPointerDown={
            handlePointerDown
          }
          onPointerMove={
            handlePointerMove
          }
          onPointerUp={
            stopDrawing
          }
          onPointerCancel={
            stopDrawing
          }
          onPointerLeave={
            stopDrawing
          }
          style={{
            display: "block",
            width: "100%",
            height: "100%",
            background: "white",
            touchAction: "none",
            cursor: "crosshair",
          }}
        />

      </div>

    </div>
  );
};

export default Whiteboard;