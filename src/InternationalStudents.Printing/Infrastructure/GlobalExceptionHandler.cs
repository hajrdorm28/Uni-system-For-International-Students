using InternationalStudents.Printing.Services;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.WebUtilities;
using MySqlConnector;

namespace InternationalStudents.Printing.Infrastructure;

/// <summary>Turns exceptions into RFC 7807 problem responses. Internal details are logged, never returned.</summary>
public sealed class GlobalExceptionHandler(
    IProblemDetailsService problemDetails,
    ILogger<GlobalExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext context, Exception exception, CancellationToken ct)
    {
        // The client went away; nothing to send.
        if (exception is OperationCanceledException && context.RequestAborted.IsCancellationRequested)
        {
            return true;
        }

        int status;
        string title;
        string detail;

        switch (exception)
        {
            case PrintingException printing:
                status = printing.StatusCode;
                title = ReasonPhrases.GetReasonPhrase(status);
                detail = printing.Message;
                logger.LogInformation("Print request rejected ({Status}): {Message}", status, printing.Message);
                break;

            case MySqlException:
                status = StatusCodes.Status503ServiceUnavailable;
                title = "Database unavailable";
                detail = "The database could not be reached. Try again shortly.";
                logger.LogError(exception, "Database error while handling {Path}", context.Request.Path);
                break;

            default:
                status = StatusCodes.Status500InternalServerError;
                title = "Unexpected error";
                detail = "Something went wrong while generating the paper.";
                logger.LogError(exception, "Unhandled error while handling {Path}", context.Request.Path);
                break;
        }

        context.Response.StatusCode = status;
        return await problemDetails.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = context,
            Exception = exception,
            ProblemDetails = { Status = status, Title = title, Detail = detail },
        });
    }
}
