namespace InternationalStudents.Printing.Models;

/// <param name="Title">Template name, used as the page title.</param>
/// <param name="BodyHtml">Template HTML with every placeholder already filled and encoded.</param>
/// <param name="ReferenceNo">print_log.reference_no printed on the paper.</param>
public sealed record PaperPage(string Title, string BodyHtml, string ReferenceNo);
