using System.Globalization;
using System.Net;
using System.Text.RegularExpressions;
using InternationalStudents.Printing.Domain;

namespace InternationalStudents.Printing.Services;

/// <summary>
/// Fills the {{placeholders}} of print_template.body_html using the rows of template_field.
/// The template HTML is trusted (written by staff); every substituted VALUE is HTML-encoded,
/// because student data is not.
/// </summary>
public static partial class TemplateRenderer
{
    [GeneratedRegex(@"\{\{\s*([A-Za-z0-9_]+)\s*\}\}", RegexOptions.CultureInvariant)]
    private static partial Regex PlaceholderPattern();

    /// <param name="sources">
    /// Values per entity, keyed by column name. A key that is missing means "unsupported column";
    /// a key whose value is null means "the column is NULL / there is no row".
    /// </param>
    /// <exception cref="TemplateRenderException">Lists every problem found, not just the first.</exception>
    public static string Render(
        string bodyHtml,
        IReadOnlyList<TemplateField> fields,
        IReadOnlyDictionary<SourceEntity, IReadOnlyDictionary<string, object?>> sources)
    {
        var fieldsByKey = fields.ToDictionary(f => f.PlaceholderKey, StringComparer.Ordinal);
        var problems = new List<string>();

        var html = PlaceholderPattern().Replace(bodyHtml, match =>
        {
            var key = match.Groups[1].Value;
            if (!fieldsByKey.TryGetValue(key, out var field))
            {
                problems.Add($"placeholder '{key}' has no row in template_field");
                return string.Empty;
            }

            return WebUtility.HtmlEncode(Resolve(field, sources, problems));
        });

        if (problems.Count > 0)
        {
            throw new TemplateRenderException(string.Join("; ", problems.Distinct()));
        }

        return html;
    }

    private static string Resolve(
        TemplateField field,
        IReadOnlyDictionary<SourceEntity, IReadOnlyDictionary<string, object?>> sources,
        List<string> problems)
    {
        var column = $"{field.SourceEntity.ToString().ToUpperInvariant()}.{field.SourceColumn}";

        if (!sources.TryGetValue(field.SourceEntity, out var entity) ||
            !entity.TryGetValue(field.SourceColumn, out var raw))
        {
            problems.Add($"field '{field.PlaceholderKey}' maps to unsupported column {column}");
            return string.Empty;
        }

        if (raw is null || (raw is string text && string.IsNullOrWhiteSpace(text)))
        {
            if (field.DefaultValue is not null)
            {
                return field.DefaultValue;
            }

            if (field.IsRequired)
            {
                problems.Add($"required field '{field.PlaceholderKey}' ({column}) has no value for this student");
            }

            return string.Empty;
        }

        try
        {
            return field.FormatString is not null && raw is IFormattable formattable
                ? formattable.ToString(field.FormatString, CultureInfo.InvariantCulture)
                : Convert.ToString(raw, CultureInfo.InvariantCulture) ?? string.Empty;
        }
        catch (FormatException)
        {
            problems.Add($"field '{field.PlaceholderKey}' has an invalid format_string '{field.FormatString}'");
            return string.Empty;
        }
    }
}
