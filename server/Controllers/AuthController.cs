using Microsoft.AspNetCore.Mvc;
using CustomWiki.Models;
using CustomWiki.Services;
using CustomWiki.DTOs;

namespace CustomWiki.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly Neo4jService _neo4j;
    private readonly AuthService _auth;

    public AuthController(Neo4jService neo4j, AuthService auth)
    {
        _neo4j = neo4j;
        _auth = auth;
    }

    [HttpPost("register")]
    public async Task<ActionResult> Register([FromBody] RegisterRequest request)
    {
        var client = await _neo4j.GetClientAsync();

        if(request.Password.Length < 8)
            return BadRequest(new { message = "Password must be 8 characters or longer" });

        var user = new User
        {
            Id = Guid.NewGuid().ToString(),
            Username = request.Username.ToLower(),
            Email = request.Email.ToLower(),
            PasswordHash = _auth.HashPassword(request.Password),
            CreatedAt = DateTime.UtcNow
        };

        try
        {
            await client.Cypher
                .Create("(u:User $user)")
                .WithParam("user", user)
                .ExecuteWithoutResultsAsync();
        }
        catch (Exception ex)
        {
            if (ex.Message.Contains("already exists with label") || 
                ex.Message.Contains("ConstraintValidationFailed"))
            {
                return BadRequest(new { message = "Email or username already exists" });
            }
            throw;
        }

        var token = _auth.GenerateJwtToken(user);

        return Ok(new
        {
            token,
            user = new
            {
                user.Id,
                user.Username,
                user.Email
            }
        });
    }

    [HttpPost("login")]
    public async Task<ActionResult> Login([FromBody] LoginRequest request)
    {
        var client = await _neo4j.GetClientAsync();

        var users = await client.Cypher
            .Match("(u:User)")
            .Where((User u) => u.Email == request.Email.ToLower())
            .Return(u => u.As<User>())
            .ResultsAsync;

        var user = users.FirstOrDefault();

        if (user == null || !_auth.VerifyPassword(request.Password, user.PasswordHash!))
            return Unauthorized(new { message = "Invalid email or password" });

        var token = _auth.GenerateJwtToken(user);

        return Ok(new
        {
            token,
            user = new
            {
                user.Id,
                user.Username,
                user.Email
            }
        });
    }
}