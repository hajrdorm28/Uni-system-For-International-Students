using InternationalStudents.Printing.Configuration;
using InternationalStudents.Printing.Data;
using InternationalStudents.Printing.Domain;
using InternationalStudents.Printing.Models;
using Microsoft.Extensions.Options;

namespace InternationalStudents.Printing.Services;

public sealed class PaperService(
    IStudentRepository students,
    IPrintRepository prints,
    IOptions<InstitutionOptions> institution,
    TimeProvider clock,
    ILogger<PaperService> logger) : IPaperService
{
    private const int MaxReferenceAttempts = 5;

    public Task<IReadOnlyList<TemplateSummary>> GetTemplatesAsync(CancellationToken ct) =>
        prints.ListActiveTemplatesAsync(ct);

    public async Task<PaperPage> GenerateAsync(
        int studentId, string templateCode, int requestedByUserId, CancellationToken ct)
    {
        // print_log.requested_by_user_id is a NOT NULL foreign key, so the requester must be a real staff user.
        if (!await students.IsStaffAsync(requestedByUserId, ct))
        {
            throw new PrintingException(StatusCodes.Status403Forbidden,
                "The requesting user must be an existing ADMIN or ADVISOR account.");
        }

        var template = await prints.GetActiveTemplateAsync(templateCode, ct)
            ?? throw new PrintingException(StatusCodes.Status404NotFound, "Unknown or inactive template.");

        var studentSources = await students.GetStudentSourcesAsync(studentId, ct)
            ?? throw new PrintingException(StatusCodes.Status404NotFound, "Student not found.");

        var fields = await prints.GetFieldsAsync(template.Id, ct);

        IReadOnlyList<PendingPayment> payments = template.PaymentPurpose is null
            ? []
            : await students.GetPendingPaymentsAsync(studentId, template.PaymentPurpose, ct);

        var sources = new Dictionary<SourceEntity, IReadOnlyDictionary<string, object?>>(studentSources)
        {
            [SourceEntity.Payment] = BuildPaymentSource(payments),
        };

        // A reference collision (practically impossible) just means: pick another and render again.
        for (var attempt = 1; attempt <= MaxReferenceAttempts; attempt++)
        {
            var reference = ReferenceNumber.Create();
            sources[SourceEntity.System] = BuildSystemSource(reference);

            string html;
            try
            {
                html = TemplateRenderer.Render(template.BodyHtml, fields, sources);
            }
            catch (TemplateRenderException ex)
            {
                await LogFailureAsync(studentId, template, requestedByUserId, ex.Message, ct);
                throw new PrintingException(StatusCodes.Status422UnprocessableEntity,
                    $"Cannot print '{template.Code}': {ex.Message}.");
            }

            var entry = new PrintLogEntry(reference, studentId, template.Id, template.Version,
                requestedByUserId, PrintOutcome.Success, null);

            // The audit row is written BEFORE the paper is returned: no log row, no paper.
            if (await prints.TryInsertLogAsync(entry, ct))
            {
                // Ids only: no names or passport numbers in application logs.
                logger.LogInformation("Printed {Template} v{Version} for student {StudentId} as {Reference}",
                    template.Code, template.Version, studentId, reference);
                return new PaperPage(template.Name, html, reference);
            }
        }

        throw new InvalidOperationException("Could not allocate a unique reference number.");
    }

    private async Task LogFailureAsync(
        int studentId, PrintTemplate template, int requestedByUserId, string message, CancellationToken ct)
    {
        for (var attempt = 1; attempt <= MaxReferenceAttempts; attempt++)
        {
            var entry = new PrintLogEntry(ReferenceNumber.Create(), studentId, template.Id, template.Version,
                requestedByUserId, PrintOutcome.Failed, message);
            if (await prints.TryInsertLogAsync(entry, ct))
            {
                return;
            }
        }
    }

    /// <summary>
    /// PAYMENT fields come from the student's PENDING payments of the template's payment_purpose.
    /// amount = sum of those rows (so "amount due" stays right with several rows); every other
    /// column comes from the most recent row. With no pending row every value is null.
    /// </summary>
    private static Dictionary<string, object?> BuildPaymentSource(IReadOnlyList<PendingPayment> payments)
    {
        var latest = payments.Count > 0 ? payments[^1] : null;
        return new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase)
        {
            ["id"] = latest?.Id,
            ["amount"] = payments.Count > 0 ? payments.Sum(p => p.Amount) : (decimal?)null,
            ["purpose"] = latest?.Purpose,
            ["status"] = latest?.Status,
            ["paid_at"] = latest?.PaidAt,
        };
    }

    private Dictionary<string, object?> BuildSystemSource(string reference)
    {
        var zone = TimeZoneInfo.FindSystemTimeZoneById(institution.Value.TimeZoneId);
        var today = TimeZoneInfo.ConvertTime(clock.GetUtcNow(), zone).Date;

        return new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase)
        {
            ["university_name"] = institution.Value.UniversityName,
            ["document_no"] = reference,
            ["current_date"] = today,
        };
    }
}
