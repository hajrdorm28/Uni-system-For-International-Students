using InternationalStudents.Printing.Configuration;
using InternationalStudents.Printing.Data;
using InternationalStudents.Printing.Infrastructure;
using InternationalStudents.Printing.Services;
using MySqlConnector;

var builder = WebApplication.CreateBuilder(args);

// ---- Configuration (validated at startup so a bad setting fails fast) ----
builder.Services.AddOptions<InstitutionOptions>()
    .Bind(builder.Configuration.GetSection(InstitutionOptions.SectionName))
    .ValidateDataAnnotations()
    .Validate(o => InstitutionOptions.IsValidTimeZone(o.TimeZoneId),
        "Institution:TimeZoneId is not a valid time zone id (use e.g. \"UTC\" or \"Africa/Cairo\").")
    .ValidateOnStart();

builder.Services.AddOptions<SecurityOptions>()
    .Bind(builder.Configuration.GetSection(SecurityOptions.SectionName))
    .ValidateDataAnnotations()
    .ValidateOnStart();

if (!builder.Environment.IsDevelopment() &&
    (builder.Configuration[$"{SecurityOptions.SectionName}:AdminApiKey"] ?? "").StartsWith("CHANGE_ME", StringComparison.Ordinal))
{
    throw new InvalidOperationException("Security:AdminApiKey still has its placeholder value. Set a real key (environment variable Security__AdminApiKey).");
}

var connectionString = builder.Configuration.GetConnectionString("UniversityDb")
    ?? throw new InvalidOperationException("Connection string 'UniversityDb' is missing.");

// ---- Services ----
// Factory registration lets the container dispose the data source on shutdown.
builder.Services.AddSingleton(_ => new MySqlDataSourceBuilder(connectionString).Build());
builder.Services.AddScoped<IStudentRepository, MySqlStudentRepository>();
builder.Services.AddScoped<IPrintRepository, MySqlPrintRepository>();
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddScoped<IPaperService, PaperService>();

builder.Services.AddControllersWithViews();
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();

var app = builder.Build();

// ---- Pipeline ----
app.UseExceptionHandler();
app.UseStatusCodePages();       // 404/405 for unknown routes also come back as problem details
if (!app.Environment.IsDevelopment())
{
    app.UseHsts();              // only takes effect over HTTPS; enable "HTTPS only" on the host
}

app.UseDefaultFiles();          // serves wwwroot/index.html at "/"
app.UseStaticFiles();
app.UseMiddleware<ApiKeyMiddleware>();
app.MapControllers();

app.Run();
