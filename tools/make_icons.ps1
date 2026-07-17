Add-Type -AssemblyName System.Drawing

$outDir = 'D:\filter_negativity\icons'
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Force $outDir | Out-Null }

# Quadratic (P0, C, P1) -> cubic bezier control points, added to a GraphicsPath
function Add-Quad($path, $p0, $c, $p1) {
    $c1 = New-Object Drawing.PointF (($p0.X + 2.0/3.0*($c.X-$p0.X)), ($p0.Y + 2.0/3.0*($c.Y-$p0.Y)))
    $c2 = New-Object Drawing.PointF (($p1.X + 2.0/3.0*($c.X-$p1.X)), ($p1.Y + 2.0/3.0*($c.Y-$p1.Y)))
    $path.AddBezier($p0, $c1, $c2, $p1)
}

function New-Icon([int]$S) {
    # Supersample for crisp antialiasing, then scale down.
    $ss = 4
    $N = $S * $ss
    $bmp = New-Object Drawing.Bitmap($N, $N, [Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([Drawing.Color]::Transparent)

    # --- Rounded-square background with Reddit-blue vertical gradient ---
    $r = $N * 0.22
    $rect = New-Object Drawing.RectangleF(0, 0, $N, $N)
    $bg = New-Object Drawing.Drawing2D.GraphicsPath
    $d = $r * 2
    $bg.AddArc(0, 0, $d, $d, 180, 90)
    $bg.AddArc($N-$d, 0, $d, $d, 270, 90)
    $bg.AddArc($N-$d, $N-$d, $d, $d, 0, 90)
    $bg.AddArc(0, $N-$d, $d, $d, 90, 90)
    $bg.CloseFigure()
    $c1 = [Drawing.Color]::FromArgb(255, 0, 121, 211)   # #0079d3
    $c2 = [Drawing.Color]::FromArgb(255, 0, 92, 163)    # #005ca3
    $grad = New-Object Drawing.Drawing2D.LinearGradientBrush($rect, $c1, $c2, 90.0)
    $g.FillPath($grad, $bg)

    # --- White shield ---
    $cx = $N/2.0
    $w  = $N * 0.50
    $top = $N * 0.20
    $h  = $N * 0.60
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
    $shield.AddLine($tl, $tr)
    $shield.AddLine($tr, $mr)
    Add-Quad $shield $mr (New-Object Drawing.PointF($right, ($top + $h*0.86))) $bt
    Add-Quad $shield $bt (New-Object Drawing.PointF($left,  ($top + $h*0.86))) $ml
    $shield.AddLine($ml, $tl)
    $shield.CloseFigure()
    $white = New-Object Drawing.SolidBrush([Drawing.Color]::White)
    $g.FillPath($white, $shield)

    # --- Blue checkmark inside the shield ---
    $pen = New-Object Drawing.Pen($c1, ($N*0.075))
    $pen.StartCap = [Drawing.Drawing2D.LineCap]::Round
    $pen.EndCap   = [Drawing.Drawing2D.LineCap]::Round
    $pen.LineJoin = [Drawing.Drawing2D.LineJoin]::Round
    $p1 = New-Object Drawing.PointF(($cx - $w*0.26), ($top + $h*0.42))
    $p2 = New-Object Drawing.PointF(($cx - $w*0.05), ($top + $h*0.60))
    $p3 = New-Object Drawing.PointF(($cx + $w*0.30), ($top + $h*0.24))
    $g.DrawLines($pen, @($p1, $p2, $p3))

    # --- Downscale to target size ---
    $out = New-Object Drawing.Bitmap($S, $S, [Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $og = [Drawing.Graphics]::FromImage($out)
    $og.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $og.PixelOffsetMode = [Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $og.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::HighQuality
    $og.Clear([Drawing.Color]::Transparent)
    $og.DrawImage($bmp, (New-Object Drawing.Rectangle(0, 0, $S, $S)))

    $path = Join-Path $outDir ("icon{0}.png" -f $S)
    $out.Save($path, [Drawing.Imaging.ImageFormat]::Png)
    $og.Dispose(); $out.Dispose(); $g.Dispose(); $bmp.Dispose()
    Write-Output ("wrote {0}" -f $path)
}

foreach ($s in 16,32,48,128) { New-Icon $s }
