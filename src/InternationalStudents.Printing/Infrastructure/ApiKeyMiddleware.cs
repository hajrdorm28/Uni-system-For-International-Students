using System.Security.Cryptography;
using System.Text;
using InternationalStudents.Printing.Configuration;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace InternationalStudents.Printing.Infrastructure;

/// <summary>
/// Guards /api and /print with the X-Admin-Key header (constant-time comparison) and marks those
/// responses as non-cacheable, because they carry personal data. Static files stay public.
/// </summary>
public sealed class ApiKeyMiddleware(RequestDelegate next, IOptions<SecurityOptions> options)
{
    private readonly byte[] _expectedKey = Encoding.UTF8.GetBytes(options.Value.AdminApiKey);

    public async Task InvokeAsync(HttpContext context)
    {
        var path = context.Request.Path;
        if (!path.StartsWithSegments("/api") && !path.StartsWithSegments("/print"))
        {
            await next(context);
            return;
        }

        context.Response.Headers.CacheControl = "no-store";
        context.Response.Headers.XContentTypeOptions = "nosniff";

        if (!IsAuthorized(context))
        {
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            await context.Response.WriteAsJsonAsync(
                new ProblemDetails
                {
                    Status = StatusCodes.Status401Unauthorized,
                    Title = "Unauthorized",
                    Detail = $"A valid {SecurityOptions.HeaderName} header is required.",
                },
                options: null,
                contentType: "application/problem+json");
            return;
        }

        await next(context);
    }

    private bool IsAuthorized(HttpContext context)
    {
        if (!context.Request.Headers.TryGetValue(SecurityOptions.HeaderName, out var values) || values.Count != 1)
        {
            return false;
        }

        var provided = Encoding.UTF8.GetBytes(values[0] ?? string.Empty);
        return CryptographicOperations.FixedTimeEquals(provided, _expectedKey);
    }
}
