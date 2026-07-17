Add-Type -AssemblyName System.Drawing

$outDir = 'D:\filter_negativity\store'
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Force $outDir | Out-Null }

function Add-Quad($path, $p0, $c, $p1) {
    $c1 = New-Object Drawing.PointF (($p0.X + 2.0/3.0*($c.X-$p0.X)), ($p0.Y + 2.0/3.0*($c.Y-$p0.Y)))
    $c2 = New-Object Drawing.PointF (($p1.X + 2.0/3.0*($c.X-$p1.X)), ($p1.Y + 2.0/3.0*($c.Y-$p1.Y)))
    $path.AddBezier($p0, $c1, $c2, $p1)
}

# Draws the shield+check centered in a box of side $S at offset ($ox,$oy)
function Draw-Shield($g, $ox, $oy, $S, $blue) {
    $cx = $ox + $S/2.0
    $w  = $S * 0.62
    $top = $oy + $S * 0.14
    $h  = $S * 0.72
    $left  = $cx - $w/2.0
    $right = $cx + $w/2.0
    $midY  = $top + $h*0.42
    $botY  = $top + $h
    $tl = New-Object Drawing.PointF($left,  $top)
    $tr = New-Object Drawing.PointF($right, $top)
    $mr = New-Object Drawing.PointF($right, $midY)
    $bt = New-Object Drawing.PointF($cx,    $botY)
    $ml = New-Object Drawing.PointF($left,  $midY)
    $shield = New-Object Drawing.Drawing2D.GraphicsPath
    $shield.AddLine($tl, $tr); $shield.AddLine($tr, $mr)
    Add-Quad $shield $mr (New-Object Drawing.PointF($right, ($top + $h*0.86))) $bt
    Add-Quad $shield $bt (New-Object Drawing.PointF($left,  ($top + $h*0.86))) $ml
    $shield.AddLine($ml, $tl); $shield.CloseFigure()
    $g.FillPath((New-Object Drawing.SolidBrush([Drawing.Color]::White)), $shield)
    $pen = New-Object Drawing.Pen($blue, ($S*0.075))
    $pen.StartCap=[Drawing.Drawing2D.LineCap]::Round; $pen.EndCap=[Drawing.Drawing2D.LineCap]::Round
    $pen.LineJoin=[Drawing.Drawing2D.LineJoin]::Round
    $p1 = New-Object Drawing.PointF(($cx - $w*0.26), ($top + $h*0.42))
    $p2 = New-Object Drawing.PointF(($cx - $w*0.05), ($top + $h*0.60))
    $p3 = New-Object Drawing.PointF(($cx + $w*0.30), ($top + $h*0.24))
    $g.DrawLines($pen, @($p1,$p2,$p3))
}

function New-Banner($W, $H, $file, $titleSize, $tagSize, $layout) {
    $blue  = [Drawing.Color]::FromArgb(255, 0, 121, 211)
    $blue2 = [Drawing.Color]::FromArgb(255, 0, 78, 140)
    $bmp = New-Object Drawing.Bitmap($W, $H, [Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode=[Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint=[Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $g.PixelOffsetMode=[Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    $rect = New-Object Drawing.RectangleF(0,0,$W,$H)
    $grad = New-Object Drawing.Drawing2D.LinearGradientBrush($rect, $blue, $blue2, 35.0)
    $g.FillRectangle($grad, 0, 0, $W, $H)

    $white = New-Object Drawing.SolidBrush([Drawing.Color]::White)
    $faint = New-Object Drawing.SolidBrush([Drawing.Color]::FromArgb(220,255,255,255))
    $titleFont = New-Object Drawing.Font("Segoe UI Semibold", $titleSize, [Drawing.FontStyle]::Bold, [Drawing.GraphicsUnit]::Pixel)
    $tagFont   = New-Object Drawing.Font("Segoe UI", $tagSize, [Drawing.FontStyle]::Regular, [Drawing.GraphicsUnit]::Pixel)

    if ($layout -eq "horizontal") {
        $iconS = $H * 0.62
        Draw-Shield $g ($H*0.22) (($H-$iconS)/2.0) $iconS $blue
        $tx = ($H*0.22) + $iconS + $H*0.14
        $sf = New-Object Drawing.StringFormat
        $g.DrawString("Reddit Positivity Filter", $titleFont, $white, $tx, ($H*0.30))
        $g.DrawString("Hide negativity. Block NSFW. Find communities you love.", $tagFont, $faint, $tx, ($H*0.30 + $titleSize*1.35))
    } else {
        $iconS = $H * 0.40
        Draw-Shield $g (($W-$iconS)/2.0) ($H*0.12) $iconS $blue
        $sf = New-Object Drawing.StringFormat; $sf.Alignment=[Drawing.StringAlignment]::Center
        $g.DrawString("Reddit Positivity Filter", $titleFont, $white, (New-Object Drawing.RectangleF(0, ($H*0.58), $W, ($H*0.2))), $sf)
        $g.DrawString("Hide negativity. Block NSFW.", $tagFont, $faint, (New-Object Drawing.RectangleF(0, ($H*0.78), $W, ($H*0.15))), $sf)
    }

    $path = Join-Path $outDir $file
    $bmp.Save($path, [Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose(); $bmp.Dispose()
    Write-Output ("wrote {0} ({1}x{2})" -f $path, $W, $H)
}

New-Banner 1400 560 "marquee-1400x560.png" 78 34 "horizontal"
New-Banner 440  280 "small-tile-440x280.png" 40 19 "vertical"
