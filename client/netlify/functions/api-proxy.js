exports.handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  try {
    // Use env override when available; fall back to local dev port
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
    
    // Get the path from the event
    let path = event.path;
    
    // Remove the function path prefix
    if (path.startsWith('/.netlify/functions/api-proxy')) {
      path = path.replace('/.netlify/functions/api-proxy', '');
    }
    
    // If path is empty, use the raw path
    if (!path || path === '/') {
      path = event.rawPath || '/';
    }
    
    // Construct the full URL
    const fullUrl = `${backendUrl}${path}`;
    
    // Prepare request options
    const requestOptions = {
      method: event.httpMethod,
      headers: {
        'Content-Type': 'application/json',
        ...(event.headers.authorization && { 'Authorization': event.headers.authorization }),
        ...(event.headers['x-requested-with'] && { 'X-Requested-With': event.headers['x-requested-with'] }),
      },
    };

    // Add body for POST/PUT requests
    if (event.body && ['POST', 'PUT', 'PATCH'].includes(event.httpMethod)) {
      requestOptions.body = event.body;
    }

    // Add query parameters if any
    if (event.queryStringParameters && Object.keys(event.queryStringParameters).length > 0) {
      const url = new URL(fullUrl);
      Object.keys(event.queryStringParameters).forEach(key => {
        url.searchParams.append(key, event.queryStringParameters[key]);
      });
      requestOptions.url = url.toString();
    }
    
    // Make the request to the backend using native fetch
    const response = await fetch(fullUrl, requestOptions);
    const data = await response.text();
    
    // Try to parse as JSON, fallback to text
    let responseData;
    try {
      responseData = JSON.parse(data);
    } catch {
      responseData = data;
    }

    return {
      statusCode: response.status,
      headers: {
        ...headers,
        'Content-Type': response.headers.get('content-type') || 'application/json',
      },
      body: JSON.stringify(responseData),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message,
        message: 'Failed to connect to backend server'
      }),
    };
  }
}; 