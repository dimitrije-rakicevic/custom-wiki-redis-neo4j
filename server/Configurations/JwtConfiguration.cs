namespace CustomWiki.Configurations;

public class JwtConfiguration
{
    public string? Secret { get; set; }
    
    public JwtConfiguration()
    {
        Secret = Environment.GetEnvironmentVariable("JWT_SECRET");
    }

    public void Validate()
    {
        if (string.IsNullOrEmpty(Secret))
        {
            throw new Exception(
                "JWT_SECRET is not set."
            );
        }
        if(Secret.Length < 32)
            throw new Exception(
                "JWT_SECRET must be at least 32 characters long."
            );
    }
}