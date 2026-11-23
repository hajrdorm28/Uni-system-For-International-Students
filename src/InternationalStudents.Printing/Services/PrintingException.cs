namespace InternationalStudents.Printing.Services;

/// <summary>A request that cannot be fulfilled, with the HTTP status the API should answer with.</summary>
public sealed class PrintingException(int statusCode, string message) : Exception(message)
{
    public int StatusCode { get; } = statusCode;
}

/// <summary>Raised by the renderer when a template cannot be filled (bad mapping or missing required data).</summary>
public sealed class TemplateRenderException(string message) : Exception(message);
