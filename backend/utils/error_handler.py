import logging

logger = logging.getLogger(__name__)

class ErrorHandler:
    @staticmethod
    def handle_exception(e, context="Operation"):
        logger.error(f"{context} failed: {str(e)}")
        return f"{context} failed: {str(e)}"
