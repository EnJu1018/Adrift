export function notFound(req, res) {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`
  });
}

export function errorHandler(error, _req, res, _next) {
  console.error(error);

  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: Object.values(error.errors)[0]?.message || '資料格式不正確'
    });
  }

  if (error.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: '資料 ID 格式不正確'
    });
  }

  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      message: '圖片大小不可超過 5MB'
    });
  }

  if (error.code === 11000) {
    const message = error.keyPattern?.userCode ? '此使用者 ID 已被使用' : '此 Email 已被註冊';

    return res.status(409).json({
      success: false,
      message
    });
  }

  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || '伺服器發生錯誤'
  });
}
