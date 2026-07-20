# GRS Smart Energy Monitoring System - Local HTTP Server
# Runs a lightweight web server on port 8080 using native .NET HttpListener

$port = 8080
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Prefixes.Add("http://127.0.0.1:$port/")

try {
    $listener.Start()
    Write-Host "==========================================================" -ForegroundColor Cyan
    Write-Host " GRS SMART ENERGY MONITORING SYSTEM DEV SERVER" -ForegroundColor Green
    Write-Host " Server running at: http://localhost:$port/ & http://127.0.0.1:$port/" -ForegroundColor Yellow
    Write-Host "==========================================================" -ForegroundColor Cyan

    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        try {
            $urlPath = $request.Url.LocalPath
            if ($urlPath -eq "/") { $urlPath = "/index.html" }

            # Remove leading slash for Join-Path
            $relPath = $urlPath.TrimStart('/')
            $filePath = Join-Path $PSScriptRoot $relPath

            if (Test-Path $filePath -PathType Leaf) {
                $bytes = [System.IO.File]::ReadAllBytes($filePath)
                
                $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
                $contentType = "text/plain; charset=utf-8"
                if ($ext -eq ".html") { $contentType = "text/html; charset=utf-8" }
                elseif ($ext -eq ".css") { $contentType = "text/css; charset=utf-8" }
                elseif ($ext -eq ".js") { $contentType = "application/javascript; charset=utf-8" }
                elseif ($ext -eq ".png") { $contentType = "image/png" }
                elseif ($ext -eq ".jpg" -or $ext -eq ".jpeg") { $contentType = "image/jpeg" }
                elseif ($ext -eq ".svg") { $contentType = "image/svg+xml" }
                
                $response.ContentType = $contentType
                $response.ContentLength64 = $bytes.Length
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
            } else {
                $response.StatusCode = 404
                $errBytes = [System.Text.Encoding]::UTF8.GetBytes("404 - File Not Found")
                $response.ContentType = "text/plain; charset=utf-8"
                $response.ContentLength64 = $errBytes.Length
                $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
            }
        }
        catch {
            Write-Host "Request error: $_" -ForegroundColor Red
        }
        finally {
            $response.OutputStream.Close()
        }
    }
}
catch {
    Write-Host "Fatal server error: $_" -ForegroundColor Red
}
finally {
    if ($listener.IsListening) { $listener.Stop() }
}
