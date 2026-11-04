# 首页 AI 场景与动画

2026-11-04，使用内置 imagegen 生成三个场景。最终网页资产为 `public/media/living.svg`、`bathroom.svg`、`bedroom.svg`；文件内嵌经过 WebP 编码的 AI 图像，原始图像为1672×941。编码转换不改变构图。原始生成文件保留于生成工具输出目录，网页完全使用仓库内的资产。

网页动画由 `landing.js` 与 `landing.css` 实时呈现：三种镜头推进/平移、柔和光影、动态虚线及场景交叉淡入，每9秒切换，支持手动切换、暂停和系统“减少动态效果”。这属于 **AI 场景素材配合网页镜头动画**，不是文本生成视频；不会把静态素材声称为真实摄影案例或已认证施工方案。

最终提示词如下。

## Living

Use case: ads-marketing. Asset type: wide cinematic website scene, 16:9. Create an elegant photoreal architectural visualization of an age-friendly Hong Kong apartment living room, warm oak and sage palette, generous open unobstructed central circulation, firm armchairs with supportive wooden armrests, neat compact rollator parked beside seating rather than blocking the route, level matte floor, low accessible storage, rounded furniture corners. Premium editorial interior photography, late afternoon sun and soft linen curtains, realistic materials, calm warm lived-in home, eye-level wide 24mm lens, no people, no words or logos or diagrams. Keep upper middle negative space for webpage headline. This image will be animated with a slow cinematic camera push and soft light movement.

## Bathroom

Use case: ads-marketing. Asset type: wide cinematic website scene, 16:9. Create a premium photoreal architectural visualization of a thoughtfully designed age-friendly home bathroom in Hong Kong: level threshold-free walk-in shower, matte subtly textured light stone floor, a robust wall-mounted horizontal and vertical grab rail anchored on solid tiled wall, supportive shower chair with back and arms, handheld shower, accessible vanity with knee clearance, generous clear maneuvering floor area. Muted sage, warm ivory, brushed steel, soft oak accents. Gentle morning daylight, coherent realistic plumbing, no bath tub, no rugs, no steps, no people, no text, no logos. Eye-level wide interior photography, left-to-right composition suitable for a cinematic website camera pan.

## Bedroom

Use case: ads-marketing. Asset type: wide cinematic website scene, 16:9. Create a photoreal calm age-friendly bedroom in a contemporary Hong Kong home. A supportive comfortably high single adjustable care bed with understated wood finish and neatly folded bedding, unobstructed broad bedside access, one neatly parked compact wheelchair with footrests, large accessible bedside switch, soft warm floor-level night lighting that guides a continuous level route toward an open bathroom door. No steps, no loose rugs, no clutter. Dusk blue beyond window with amber bedside light, sage and ivory textiles and warm oak. Premium cinematic architectural photography, wide 24mm eye-level view, no people, no logos, no words. Good depth for a subtle animated camera push. Concept illustration, not a technical dimension drawing.

## 展示范围

场景图只用作介绍。图像中的物品不自动充当产品尺寸、承重、防滑性能或建筑净空的证据。设计工作台只使用客户明确选择的产品、独立3D类别模型及声明的整体尺寸，通过确定性几何检查后摆放；现场安装及适用规定仍需另外核对。
