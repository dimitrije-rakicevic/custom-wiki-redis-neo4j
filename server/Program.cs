using CustomWiki.Configurations;
using CustomWiki.Hubs;
using CustomWiki.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using System.Text;

DotNetEnv.Env.Load();

var builder = WebApplication.CreateBuilder(args);

var neo4jConfig = new Neo4jConfiguration();
var redisConfig = new RedisConfiguration();
var jwtConfig = new JwtConfiguration();

neo4jConfig.Validate();
redisConfig.Validate();
jwtConfig.Validate();

builder.Services.AddSingleton(neo4jConfig);
builder.Services.AddSingleton(redisConfig);
builder.Services.AddSingleton(jwtConfig);

builder.Services.AddSingleton<Neo4jService>();
builder.Services.AddSingleton<RedisService>();
builder.Services.AddScoped<AuthService>();

builder.Services.AddControllers();

builder.Services.AddSignalR();

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Enter JWT token: Bearer {your-token}"
    });

    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        var key = Encoding.UTF8.GetBytes(jwtConfig.Secret!);
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(key),
            ValidateIssuer = false,
            ValidateAudience = false,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.Zero
        };
    });

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy
            .WithOrigins(
                // "http://localhost:5073",
                // "https://localhost:5073",
                // "http://127.0.0.1:5073",
                // "https://127.0.0.1:5073",
                "http://localhost:5500",
                "https://localhost:5500",
                "http://127.0.0.1:5500",
                "https://127.0.0.1:5500"
                )
            .AllowAnyMethod()
            .AllowAnyHeader()
            .AllowCredentials();
    });
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

app.MapHub<ChatHub>("/chathub");
app.MapControllers();

Console.WriteLine("CustomWiki API is running!");
Console.WriteLine($"Swagger UI: {(app.Environment.IsDevelopment() ? "http://localhost:5073/swagger" : "Disabled")}");

app.Run();