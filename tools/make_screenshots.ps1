Add-Type -AssemblyName System.Drawing

$outDir = 'D:\filter_negativity\store'
$W = 1280; $H = 800

function New-Shot($srcPath, $file, $title, $lines) {
    $blue  = [Drawing.Color]::FromArgb(255, 0, 121, 211)
    $blue2 = [Drawing.Color]::FromArgb(255, 0, 78, 140)
    $bmp = New-Object Drawing.Bitmap($W, $H, [Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode=[Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode=[Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.TextRenderingHint=[Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $g.PixelOffsetMode=[Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    $rect = New-Object Drawing.RectangleF(0,0,$W,$H)
    $grad = New-Object Drawing.Drawing2D.LinearGradientBrush($rect, $blue, $blue2, 40.0)
    $g.FillRectangle($grad, 0, 0, $W, $H)

    # popup image, scaled to fit ~700px tall, placed on the left
    $src = [Drawing.Image]::FromFile($srcPath)
    $ph = 700.0; $scale = $ph / $src.Height; $pw = $src.Width * $scale
    $px = 90; $py = ($H - $ph)/2.0
    # soft shadow
    $shadow = New-Object Drawing.SolidBrush([Drawing.Color]::FromArgb(60,0,0,0))
    $g.FillRectangle($shadow, ($px+8), ($py+10), $pw, $ph)
    $g.DrawImage($src, (New-Object Drawing.RectangleF($px, $py, $pw, $ph)))
    $src.Dispose()

    # caption block on the right
    $white = New-Object Drawing.SolidBrush([Drawing.Color]::White)
    $faint = New-Object Drawing.SolidBrush([Drawing.Color]::FromArgb(225,255,255,255))
    $tFont = New-Object Drawing.Font("Segoe UI Semibold", 46, [Drawing.FontStyle]::Bold, [Drawing.GraphicsUnit]::Pixel)
    $bFont = New-Object Drawing.Font("Segoe UI", 26, [Drawing.FontStyle]::Regular, [Drawing.GraphicsUnit]::Pixel)
    $tx = $px + $pw + 80
    $tw = $W - $tx - 70
    $g.DrawString($title, $tFont, $white, (New-Object Drawing.RectangleF($tx, 210, $tw, 200)))
    $y = 210 + 130
    foreach ($ln in $lines) {
        $g.DrawString($ln, $bFont, $faint, (New-Object Drawing.RectangleF($tx, $y, $tw, 120)))
        $y += 78
    }

    $out = Join-Path $outDir $file
    $bmp.Save($out, [Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose(); $bmp.Dispose()
    Write-Output ("wrote {0}" -f $out)
}

New-Shot 'D:\filter_negativity\docs\screenshots\popup-filter.png' 'screenshot-1-filter-1280x800.png' `
    "Filter out the negativity" @(
    "-  Block adult / NSFW posts and communities",
    "-  Hide topics you choose - fully editable",
    "-  On-device AI blurs explicit images",
    "-  Nothing ever leaves your browser")

New-Shot 'D:\filter_negativity\docs\screenshots\popup-finder.png' 'screenshot-2-finder-1280x800.png' `
    "Find communities you love" @(
    "-  Search any interest, get the best subs",
    "-  One-click block any community",
    "-  Backup and restore your setup",
    "-  Works on Chrome and Edge (Manifest V3)")
