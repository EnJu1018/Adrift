export function notFound(req, res) {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`
  });
}

export function errorHandler(error, _req, res, _next) {
  console.error('API request failed', { name: error.name, code: error.code, status: error.statusCode || error.status });

  if (error.type === 'entity.parse.failed' || error.type === 'entity.too.large') {
    return res.status(400).json({ success: false, message: '請求格式不正確或內容過大' });
  }

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
      message: error.field === 'avatar' ? '頭貼檔案不可超過 10MB' : '圖片大小不可超過 5MB'
    });
  }

  if (error.code === 11000) {
    const message = error.keyPattern?.userCode ? '此使用者 ID 已被使用' : '此 Email 已被使用';

    return res.status(409).json({
      success: false,
      message
    });
  }

  const status = Number(error.statusCode) >= 400 && Number(error.statusCode) < 500 ? Number(error.statusCode) : 500;
  res.status(status).json({
    success: false,
    message: status < 500 ? error.message : '伺服器暫時無法完成，請稍後重試'
  });
}
