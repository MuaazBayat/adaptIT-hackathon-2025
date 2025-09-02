from loguru import logger
from django.http import Http404


class RequestLoggingMiddleware:
    """
    Middleware to log all incoming requests and their responses.
    Especially useful for debugging 404s and API issues.
    """
    
    def __init__(self, get_response):
        self.get_response = get_response
        
    def __call__(self, request):
        # Log incoming request
        logger.info(
            f"Request: {request.method} {request.path} | "
            f"IP: {self.get_client_ip(request)} | "
            f"User-Agent: {request.META.get('HTTP_USER_AGENT', 'Unknown')[:100]}"
        )
        
        # Log request details for debugging
        if request.method == 'POST':
            logger.debug(f"POST body: {request.body}")
        if request.GET:
            logger.debug(f"GET params: {dict(request.GET)}")
        
        # Process request
        try:
            response = self.get_response(request)
        except Http404 as e:
            logger.warning(
                f"404 Not Found: {request.method} {request.path} | "
                f"IP: {self.get_client_ip(request)} | "
                f"Referrer: {request.META.get('HTTP_REFERER', 'None')}",
                extra={"request_path": request.path}
            )
            raise
        except Exception as e:
            logger.error(
                f"Request error: {request.method} {request.path} | "
                f"Error: {str(e)}",
                extra={"request_path": request.path}
            )
            raise

        # Helper to safely get response size
        def get_response_size(resp):
            try:
                return len(resp.content)
            except AttributeError:
                # Streaming responses (WhiteNoise) don't have .content
                return None

        # Helper to safely get snippet of response
        def get_response_snippet(resp, n=200):
            try:
                return resp.content[:n]
            except AttributeError:
                return b"<streaming response>"

        # Log response
        size = get_response_size(response)
        logger.info(
            f"Response: {response.status_code} | "
            f"Path: {request.path} | "
            f"Size: {size if size is not None else 'streaming/unknown'} bytes"
        )

        # Log 4xx and 5xx responses with more detail
        if response.status_code >= 400:
            snippet = get_response_snippet(response)
            logger.warning(
                f"HTTP {response.status_code}: {request.method} {request.path} | "
                f"Response: {snippet}",
                extra={"request_path": request.path}
            )

        return response
    
    def get_client_ip(self, request):
        """Extract client IP from request headers"""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip