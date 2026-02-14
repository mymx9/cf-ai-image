document.addEventListener('DOMContentLoaded', function () {
    // 初始化模型列表
    let availableModels = [];
    let randomPromptsList = [];
    let currentImageParams = {};
    let currentImagesArray = null; // 多图时的DataURL数组

    // 加载模型列表
    async function loadModels() {
        try {
            const response = await fetch('/api/models');
            if (!response.ok) {
                throw new Error('加载模型列表失败');
            }

            availableModels = await response.json();
            const modelSelect = document.getElementById('model');

            // 清空当前选项
            modelSelect.innerHTML = '';

            // 添加新选项
            availableModels.forEach(model => {
                const option = document.createElement('option');
                option.value = model.id;
                option.textContent = `${model.name} - ${model.description}`;
                option.dataset.requiresImage = model.requiresImage ? '1' : '0';
                modelSelect.appendChild(option);
            });

            // 默认选择第二个模型（通常是更好的模型）
            if (availableModels.length > 1) {
                modelSelect.value = availableModels[1].id;
            }
        } catch (error) {
            console.error('加载模型列表错误:', error);
            showStatus('加载模型列表失败', 'error');
        }
    }

    // 加载随机提示词
    async function loadRandomPrompts() {
        try {
            const response = await fetch('/api/prompts');
            if (!response.ok) {
                throw new Error('加载提示词失败');
            }

            randomPromptsList = await response.json();
        } catch (error) {
            console.error('加载提示词错误:', error);
            randomPromptsList = ['未能加载提示词列表，请重试或手动输入'];
        }
    }

    // 初始化加载资源
    loadModels();
    loadRandomPrompts();
    // 检查是否需要登录
    (async () => {
        try {
            const res = await fetch('/api/config');
            if (res.ok) {
                const cfg = await res.json();
                if (cfg.require_password) {
                    showLogin();
                }
            }
        } catch (_) {}
    })();

    // 主题切换功能相关代码
    const themeToggle = document.getElementById('themeToggle');
    const html = document.documentElement;
    const moonIcon = `<i class="fa-solid fa-moon"></i>`;
    const sunIcon = `<i class="fa-solid fa-sun"></i>`;

    // 检查系统主题或存储的主题并设置初始状态
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        html.classList.add('dark');
        themeToggle.innerHTML = sunIcon;
        themeToggle.setAttribute('aria-label', '切换亮色主题');
    } else {
        html.classList.remove('dark');
        themeToggle.innerHTML = moonIcon;
        themeToggle.setAttribute('aria-label', '切换暗色主题');
    }

    themeToggle.addEventListener('click', function() {
        if (html.classList.contains('dark')) {
            html.classList.remove('dark');
            localStorage.theme = 'light';
            themeToggle.innerHTML = moonIcon;
            themeToggle.setAttribute('aria-label', '切换暗色主题');
        } else {
            html.classList.add('dark');
            localStorage.theme = 'dark';
            themeToggle.innerHTML = sunIcon;
            themeToggle.setAttribute('aria-label', '切换亮色主题');
        }
    });

    // 高级选项切换
    const toggleAdvanced = document.getElementById('toggleAdvanced');
    const advancedOptions = document.getElementById('advancedOptions');
    const advancedIcon = document.getElementById('advancedIcon');

    toggleAdvanced.addEventListener('click', function() {
        if (advancedOptions.classList.contains('hidden')) {
            advancedOptions.classList.remove('hidden');
            advancedIcon.classList.remove('fa-chevron-down');
            advancedIcon.classList.add('fa-chevron-up');
        } else {
            advancedOptions.classList.add('hidden');
            advancedIcon.classList.remove('fa-chevron-up');
            advancedIcon.classList.add('fa-chevron-down');
        }
    });

    // 模型切换时显示/隐藏图生图字段
    const modelSelectEl = document.getElementById('model');
    const img2imgInputs = document.getElementById('img2imgInputs');
    if (modelSelectEl && img2imgInputs) {
        modelSelectEl.addEventListener('change', function() {
            const selected = availableModels.find(m => m.id === this.value);
            if (selected && selected.requiresImage) {
                img2imgInputs.classList.remove('hidden');
            } else {
                img2imgInputs.classList.add('hidden');
            }
        });
    }

    // 滑块值显示
    const sliders = ['width', 'height', 'num_steps', 'guidance'];
    sliders.forEach(id => {
        const slider = document.getElementById(id);
        const valueDisplay = document.getElementById(`${id}Value`);

        slider.addEventListener('input', function() {
            if (id === 'width' || id === 'height') {
                valueDisplay.textContent = `${this.value}px`;
            } else if (id === 'guidance') {
                valueDisplay.textContent = parseFloat(this.value).toFixed(2);
            } else {
                valueDisplay.textContent = this.value;
            }
        });
    });

    // 生成数量控件
    const countContainer = document.createElement('div');
    countContainer.className = 'mt-2';
    countContainer.innerHTML = `
        <label for="num_outputs" class="block text-sm font-medium mb-1 flex items-center">
            <i class="fa-solid fa-layer-group mr-1 text-xs"></i> 生成数量
        </label>
        <select id="num_outputs" class="w-full">
            <option value="1" selected>1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
            <option value="5">5</option>
            <option value="6">6</option>
            <option value="7">7</option>
            <option value="8">8</option>
        </select>
    `;
    document.querySelector('.card.p-4.space-y-4.fade-in').appendChild(countContainer);

    // 随机种子
    document.getElementById('randomSeed').addEventListener('click', function() {
        const randomSeed = Math.floor(Math.random() * 4294967295);
        document.getElementById('seed').value = randomSeed;
    });

    // 随机提示词
    document.getElementById('randomButton').addEventListener('click', function() {
        if (randomPromptsList.length > 0) {
            const randomIndex = Math.floor(Math.random() * randomPromptsList.length);
            document.getElementById('prompt').value = randomPromptsList[randomIndex];
        } else {
            showStatus('提示词列表未加载，请稍后再试', 'error');
        }
    });

    // 复制参数
    document.getElementById('copyParamsButton').addEventListener('click', function() {
        if (!currentImageParams) return;

        // 创建参数文本
        let paramsText = '--- AI绘图创作生成参数 ---\n';
        for (const [key, value] of Object.entries(currentImageParams)) {
            if (key === 'password') continue; // 不复制密码
            paramsText += `${formatParamName(key)}: ${value}\n`;
        }

        // 复制到剪贴板
        navigator.clipboard.writeText(paramsText)
            .then(() => {
                showStatus('参数已复制到剪贴板', 'success');
            })
            .catch(err => {
                console.error('复制失败:', err);
                showStatus('复制参数失败', 'error');
            });
    });

    // 格式化参数名称
    function formatParamName(name) {
        const nameMap = {
            'prompt': '正向提示词',
            'negative_prompt': '反向提示词',
            'model': '文生图模型',
            'width': '图像宽度',
            'height': '图像高度',
            'num_steps': '迭代步数',
            'guidance': '引导系数',
            'seed': '随机种子'
        };
        return nameMap[name] || name;
    }

    // 下载图像
    document.getElementById('downloadButton').addEventListener('click', async function() {
        const img = document.getElementById('aiImage');
        const gallery = document.getElementById('imageGallery');
        let src = '';
        if (!gallery.classList.contains('hidden') && currentImagesArray && currentImagesArray.length > 0) {
            src = currentImagesArray[0];
        } else {
            src = img.src;
        }
        if (!src) {
            showStatus('没有可下载的图像', 'error');
            return;
        }

        try {
            // 从图像数据创建blob
            const response = await fetch(src);
            const blob = await response.blob();

            // 创建下载链接
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;

            // 生成文件名
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const model = document.getElementById('usedModel').textContent || 'ai-image';
            link.download = `${model}-${timestamp}.png`;

            // 触发下载
            document.body.appendChild(link);
            link.click();

            // 清理
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);

            showStatus('图像下载成功', 'success');
        } catch (error) {
            console.error('下载图像错误:', error);
            showStatus('下载图像失败', 'error');
        }
    });

    // 下载 ZIP（多图）
    document.getElementById('downloadZipButton').addEventListener('click', async function() {
        if (!currentImagesArray || currentImagesArray.length === 0) {
            showStatus('没有可打包的图片', 'error');
            return;
        }
        try {
            const zip = new JSZip();
            const model = document.getElementById('usedModel').textContent || 'ai-image';
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            for (let i = 0; i < currentImagesArray.length; i++) {
                const dataURL = currentImagesArray[i];
                const base64 = dataURL.split(',')[1];
                zip.file(`${model}-${timestamp}-${i+1}.png`, base64, { base64: true });
            }
            const blob = await zip.generateAsync({ type: 'blob' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${model}-${timestamp}.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            showStatus('ZIP 下载已开始', 'success');
        } catch (e) {
            console.error('ZIP打包失败:', e);
            showStatus('打包ZIP失败', 'error');
        }
    });

    // 提交生成请求
    // 复用全局的计时器与控制器，避免闪烁
    let progressTimer = null;
    let pendingController = null;

    document.getElementById('submitButton').addEventListener('click', async function() {
        // 显示加载中状态
        const loadingOverlay = document.getElementById('loadingOverlay');
        const initialPrompt = document.getElementById('initialPrompt');
        const aiImage = document.getElementById('aiImage');
        const progressBarContainer = document.getElementById('progressBarContainer');
        const progressBar = document.getElementById('progressBar');
        const progressText = document.getElementById('progressText');
        const progressExtra = document.getElementById('progressExtra');

        if (!loadingOverlay || !initialPrompt || !aiImage) {
            console.error('必要的DOM元素未找到');
            return;
        }

        // 隐藏初始提示和图像
        initialPrompt.classList.add('hidden');
        aiImage.classList.add('hidden');
        loadingOverlay.classList.remove('hidden');

        // 隐藏之前的提示和按钮，并清理上一次状态
        const imageStatus = document.getElementById('imageStatus');
        const copyParamsButton = document.getElementById('copyParamsButton');
        const downloadButton = document.getElementById('downloadButton');

        if (imageStatus) imageStatus.classList.add('hidden');
        if (copyParamsButton) copyParamsButton.classList.add('hidden');
        if (downloadButton) downloadButton.classList.add('hidden');
        if (progressTimer) { clearInterval(progressTimer); progressTimer = null; }
        if (pendingController) { try { pendingController.abort(); } catch(_){} pendingController = null; }

        // 获取参数（初始草案）
        const rawParams = {
            password: document.getElementById('password')?.value || '',
            prompt: document.getElementById('prompt')?.value || '',
            negative_prompt: document.getElementById('negative_prompt')?.value || '',
            model: document.getElementById('model')?.value,
            width: parseInt(document.getElementById('width')?.value) || 1024,
            height: parseInt(document.getElementById('height')?.value) || 1024,
            num_steps: parseInt(document.getElementById('num_steps')?.value) || 20,
            guidance: parseFloat(document.getElementById('guidance')?.value) || 7.5,
            seed: parseInt(document.getElementById('seed')?.value) || Math.floor(Math.random() * 4294967295),
            image_url: document.getElementById('image_url')?.value || '',
            mask_url: document.getElementById('mask_url')?.value || '',
            num_outputs: parseInt(document.getElementById('num_outputs')?.value) || 1
        };
        // 基于模型特性，清洗出最终要发送/展示的参数
        const selectedModelMeta = availableModels.find(m => m.id === rawParams.model);
        const params = {
            password: rawParams.password,
            prompt: rawParams.prompt,
            negative_prompt: rawParams.negative_prompt,
            model: rawParams.model,
            width: rawParams.width,
            height: rawParams.height,
            num_steps: rawParams.num_steps,
            guidance: rawParams.guidance,
            seed: rawParams.seed,
            num_outputs: rawParams.num_outputs
        };
        if (selectedModelMeta?.requiresImage) {
            params.image_url = rawParams.image_url;
        }
        if (selectedModelMeta?.requiresMask) {
            params.mask_url = rawParams.mask_url;
        }

        // 保存当前参数
        currentImageParams = {...params};

        // 前端必填校验（依据模型元信息）
        if (selectedModelMeta && selectedModelMeta.requiresImage) {
            if (!rawParams.image_url) {
                showStatus('该模型需要提供输入图像URL', 'error');
                loadingOverlay.classList.add('hidden');
                initialPrompt.classList.remove('hidden');
                return;
            }
        }
        if (selectedModelMeta && selectedModelMeta.requiresMask) {
            if (!rawParams.mask_url) {
                showStatus('局部重绘模型需要提供遮罩URL', 'error');
                loadingOverlay.classList.add('hidden');
                initialPrompt.classList.remove('hidden');
                return;
            }
        }

        try {
            // 发送请求
            const startTime = performance.now();

            // 启动拟真进度条
            let progress = 0;
            if (progressBarContainer && progressBar && progressText) {
                progressBarContainer.classList.remove('hidden');
                progress = 0;
                progressBar.style.width = '0%';
                progressText.textContent = '0%';
                if (progressExtra) progressExtra.textContent = '估算';
                const steps = params.num_steps || 20;
                const baseMs = Math.max(4000, Math.min(20000, steps * 600));
                const startTs = Date.now();
                progressTimer = setInterval(() => {
                    const elapsed = Date.now() - startTs;
                    const ratio = Math.min(0.95, elapsed / baseMs); // 最高到95%，等待真实完成再封顶
                    const cur = Math.floor(ratio * 100);
                    if (cur > progress) {
                        progress = cur;
                        progressBar.style.width = `${progress}%`;
                        progressText.textContent = `${progress}%`;
                    }
                }, 150);
            }

            // 60秒超时控制
            pendingController = new AbortController();
            const timeoutId = setTimeout(() => pendingController && pendingController.abort('timeout'), 60000);

            const response = await fetch('/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'image/*'
                },
                body: JSON.stringify(params),
                signal: pendingController.signal
            });
            clearTimeout(timeoutId);

            if (!response.ok) {
                const contentType = response.headers.get('content-type');
                if (contentType?.includes('application/json')) {
                    const errorData = await response.json();
                    const msg = errorData.error || errorData.message || '生成失败';
                    const details = errorData.details ? `（${errorData.details}）` : '';
                    throw new Error(`${msg}${details}`);
                } else {
                    const errorText = await response.text();
                    console.error('服务器错误:', errorText);
                    throw new Error('生成失败');
                }
            }

            const respType = response.headers.get('content-type') || '';
            const serverSecondsHeader = response.headers.get('X-Server-Seconds');
            let serverSeconds = serverSecondsHeader ? parseFloat(serverSecondsHeader) : null;

            let base64Image = '';
            let imageBlob = null;
            let imagesArray = null;

            if (respType.includes('application/json')) {
                const json = await response.json();
                if (Array.isArray(json.images)) {
                    imagesArray = json.images;
                    base64Image = imagesArray[0];
                } else {
                    throw new Error('响应格式错误');
                }
            } else {
                imageBlob = await response.blob();
                base64Image = await blobToBase64(imageBlob);
            }
                const endTime = performance.now();
                const generationTime = ((endTime - startTime) / 1000).toFixed(2);

            // 设置图像信息并显示图像
            const gallery = document.getElementById('imageGallery');
            gallery.innerHTML = '';
            if (imagesArray && imagesArray.length > 1) {
                aiImage.classList.add('hidden');
                gallery.classList.remove('hidden');
                currentImagesArray = imagesArray.slice();
                imagesArray.forEach((src, idx) => {
                    const wrap = document.createElement('div');
                    wrap.className = 'relative group';

                    const img = document.createElement('img');
                    img.src = src;
                    img.alt = `生成的图像 ${idx+1}`;
                    img.className = 'w-full h-auto rounded';
                    img.style.cursor = 'zoom-in';
                    img.addEventListener('click', () => openImageModal(src));

                    // 悬浮操作条
                    const bar = document.createElement('div');
                    bar.className = 'absolute bottom-1 left-1 right-1 hidden group-hover:flex bg-black bg-opacity-50 text-white text-xs rounded px-1 py-0.5 gap-1 justify-center';

                    const btnZoom = document.createElement('button');
                    btnZoom.innerHTML = '<i class="fa-solid fa-magnifying-glass-plus"></i>';
                    btnZoom.title = '放大';
                    btnZoom.onclick = (e) => { e.stopPropagation(); openImageModal(src); };

                    const btnCopy = document.createElement('button');
                    btnCopy.innerHTML = '<i class="fa-solid fa-copy"></i>';
                    btnCopy.title = '复制到剪贴板';
                    btnCopy.onclick = async (e) => {
                        e.stopPropagation();
                        try {
                            await navigator.clipboard.writeText(src);
                            showStatus('图片已复制到剪贴板', 'success');
                        } catch (_) {
                            showStatus('复制失败', 'error');
                        }
                    };

                    const btnDl = document.createElement('button');
                    btnDl.innerHTML = '<i class="fa-solid fa-download"></i>';
                    btnDl.title = '下载此图';
                    btnDl.onclick = async (e) => {
                        e.stopPropagation();
                        try {
                            const response = await fetch(src);
                            const blob = await response.blob();
                            const url = window.URL.createObjectURL(blob);
                            const link = document.createElement('a');
                            const model = document.getElementById('usedModel').textContent || 'ai-image';
                            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                            link.href = url;
                            link.download = `${model}-${timestamp}-${idx+1}.png`;
                            document.body.appendChild(link); link.click(); document.body.removeChild(link);
                            window.URL.revokeObjectURL(url);
                        } catch (_) {
                            showStatus('下载失败', 'error');
                        }
                    };

                    bar.appendChild(btnZoom);
                    bar.appendChild(btnCopy);
                    bar.appendChild(btnDl);

                    wrap.appendChild(img);
                    wrap.appendChild(bar);
                    gallery.appendChild(wrap);
                });
            } else {
                gallery.classList.add('hidden');
                currentImagesArray = null;
                aiImage.src = base64Image;
            }

            // 统一的UI完成逻辑（不依赖onload也能执行一次）
            const finalize = () => {
                // 图像加载完成后更新UI
                loadingOverlay.classList.add('hidden');
                if (!imagesArray || imagesArray.length <= 1) {
                    aiImage.classList.remove('hidden');
                }

                // 安全地更新信息显示
                const elements = {
                    generationTime: document.getElementById('generationTime'),
                    usedModel: document.getElementById('usedModel'),
                    computeInfo: document.getElementById('computeInfo'),
                    imageSize: document.getElementById('imageSize')
                };

                if (elements.generationTime) {
                    elements.generationTime.textContent = `${generationTime}秒`;
                }
                if (elements.usedModel) {
                    elements.usedModel.textContent = getModelNameById(params.model);
                }

                // 从响应头提取信息
                const usedModelHeader = response.headers.get('X-Used-Model');
                const usedModelName = usedModelHeader ? getModelNameById(usedModelHeader) : getModelNameById(params.model);
                if (elements.usedModel) elements.usedModel.textContent = usedModelName;

                const bytesStr = response.headers.get('X-Image-Bytes');
                if (elements.imageSize) {
                    if (bytesStr) {
                        const bytes = parseInt(bytesStr, 10);
                        elements.imageSize.textContent = formatBytes(bytes);
                    } else if (imageBlob) {
                        // 回退：用blob大小
                        elements.imageSize.textContent = formatBytes(imageBlob.size);
                    } else if (imagesArray && imagesArray[0]) {
                        elements.imageSize.textContent = formatBytes(dataURLBytes(imagesArray[0]));
                    }
                }

                // 计算真实it/s：迭代步数 / 实际耗时
                const itPerSec = (() => {
                    const steps = Number(params.num_steps) || 0;
                    const seconds = serverSeconds && serverSeconds > 0 ? serverSeconds : (parseFloat(generationTime) || 0);
                    if (steps > 0 && seconds > 0) {
                        return (steps / seconds).toFixed(2);
                    }
                    return '-';
                })();
                if (elements.computeInfo) {
                    elements.computeInfo.textContent = `${itPerSec}`;
                }

                // 更新所有参数面板（隐藏不相关字段）
                updateParamsDisplay(params);

                // 填充每张图片的尺寸与大小
                const metaPanel = document.getElementById('imageMeta');
                const metaBody = document.getElementById('imageMetaBody');
                if (imagesArray && imagesArray.length > 0 && metaPanel && metaBody) {
                    metaBody.innerHTML = '';
                    const loadPromises = imagesArray.map((src, i) => new Promise((resolve) => {
                        const probe = new Image();
                        probe.onload = () => {
                            const tr = document.createElement('tr');
                            const sizeBytes = dataURLBytes(src);
                            tr.innerHTML = `<td class="py-1 pr-3">${i+1}</td><td class="py-1 pr-3">${probe.width}×${probe.height}</td><td class="py-1">${formatBytes(sizeBytes)}</td>`;
                            metaBody.appendChild(tr);
                            resolve();
                        };
                        probe.onerror = () => resolve();
                        probe.src = src;
                    }));
                    Promise.all(loadPromises).then(() => metaPanel.classList.remove('hidden'));
                } else {
                    const panel = document.getElementById('imageMeta');
                    if (panel) panel.classList.add('hidden');
                }

                // 进度条收口到100%
                if (progressBarContainer && progressBar && progressText) {
                    if (progressTimer) clearInterval(progressTimer);
                    progressBar.style.width = '100%';
                    progressText.textContent = '100%';
                    setTimeout(() => progressBarContainer.classList.add('hidden'), 800);
                }

                // 显示状态和操作按钮
                showStatus(imagesArray ? `生成成功（${imagesArray.length} 张）` : '生成成功', 'success');
                if (copyParamsButton) copyParamsButton.classList.remove('hidden');
                if (downloadButton) downloadButton.classList.remove('hidden');
                const downloadZipButton = document.getElementById('downloadZipButton');
                if (downloadZipButton) {
                    if (imagesArray && imagesArray.length > 1) downloadZipButton.classList.remove('hidden');
                    else downloadZipButton.classList.add('hidden');
                }
            };

            // 触发finalize
            if (imagesArray && imagesArray.length > 1) {
                finalize();
            } else {
                aiImage.onload = finalize;
            }

        } catch (error) {
            console.error('生成图像错误:', error);
            if (error && (error.name === 'AbortError' || error.message === 'timeout')) {
                showStatus('生成超时，请尝试更换模型或降低宽高后重试', 'error');
            } else {
                showStatus(error.message || '生成失败', 'error');
            }
            // 显示初始提示
            initialPrompt.classList.remove('hidden');
            aiImage.classList.add('hidden');
        } finally {
            loadingOverlay.classList.add('hidden');
            if (progressTimer) { clearInterval(progressTimer); progressTimer = null; }
            if (progressBarContainer) progressBarContainer.classList.add('hidden');
            pendingController = null;
        }
    });

    // 将Blob转换为Base64
    function blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    // 字节转可读字符串
    function formatBytes(bytes) {
        if (!bytes && bytes !== 0) return '-';
        const sizes = ['B', 'KB', 'MB', 'GB'];
        if (bytes === 0) return '0 B';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        const value = (bytes / Math.pow(1024, i)).toFixed(2);
        return `${value} ${sizes[i]}`;
    }

    // 计算dataURL的字节大小（粗略）
    function dataURLBytes(dataURL) {
        try {
            const base64 = dataURL.split(',')[1] || '';
            // base64长度 * 3/4 约等于字节数
            return Math.floor((base64.length * 3) / 4);
        } catch (_) {
            return 0;
        }
    }

    // 简易图片放大预览
    function openImageModal(src) {
        const existing = document.getElementById('imgModal');
        if (existing) existing.remove();
        const modal = document.createElement('div');
        modal.id = 'imgModal';
        modal.style.position = 'fixed';
        modal.style.inset = '0';
        modal.style.background = 'rgba(0,0,0,0.7)';
        modal.style.display = 'flex';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
        modal.style.zIndex = '1000';
        modal.innerHTML = `
          <div class="max-w-5xl max-h-[90vh] p-2">
            <img src="${src}" class="rounded shadow-lg max-h-[85vh] mx-auto" />
            <div class="text-center mt-2">
              <button id="closeImgModal" class="btn btn-secondary">关闭</button>
            </div>
          </div>`;
        document.body.appendChild(modal);
        document.getElementById('closeImgModal').onclick = () => modal.remove();
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    }

    // 通过ID获取模型名称
    function getModelNameById(id) {
        const model = availableModels.find(m => m.id === id);
        return model ? model.name : id;
    }

    // 更新参数显示
    function updateParamsDisplay(params) {
        const allParamsContainer = document.getElementById('allParamsContainer');
        const allParamsElement = document.getElementById('allParams');

        if (!allParamsContainer || !allParamsElement) return;

        // 清空现有参数
        allParamsElement.innerHTML = '';

        // 添加新参数
        for (const [key, value] of Object.entries(params)) {
            if (key === 'password') continue; // 不显示密码

            const paramName = formatParamName(key);
            const paramValue = value;

            // 创建参数徽章
            const badge = document.createElement('div');
            badge.className = 'param-badge';
            badge.innerHTML = `<span class="font-medium">${paramName}:</span> ${paramValue}`;

            allParamsElement.appendChild(badge);
        }

        // 显示参数容器
        allParamsContainer.classList.remove('hidden');
    }

    // 显示状态提示
    function showStatus(message, type = 'info') {
        const statusElement = document.getElementById('imageStatus');
        if (!statusElement) return;

        // 设置样式
        statusElement.className = '';
        switch (type) {
            case 'success':
                statusElement.classList.add('bg-green-100', 'text-green-800', 'dark:bg-green-900', 'dark:text-green-100');
                break;
            case 'error':
                statusElement.classList.add('bg-red-100', 'text-red-800', 'dark:bg-red-900', 'dark:text-red-100');
                break;
            case 'warning':
                statusElement.classList.add('bg-yellow-100', 'text-yellow-800', 'dark:bg-yellow-900', 'dark:text-yellow-100');
                break;
            default:
                statusElement.classList.add('bg-blue-100', 'text-blue-800', 'dark:bg-blue-900', 'dark:text-blue-100');
        }

        // 设置消息
        statusElement.textContent = message;

        // 显示
        statusElement.classList.remove('hidden');

        // 5秒后自动隐藏
        setTimeout(() => {
            statusElement.classList.add('hidden');
        }, 5000);
    }
});

// 登录遮罩及逻辑（全局函数以便在HTML中调用）
function showLogin() {
    if (document.getElementById('loginOverlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'loginOverlay';
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.backdropFilter = 'blur(3px)';
    overlay.style.background = 'rgba(0,0,0,0.4)';
    overlay.style.zIndex = '1000';
    overlay.innerHTML = `
        <div class="w-full h-full flex items-center justify-center">
          <div class="card p-6 w-96 bg-white dark:bg-gray-800">
            <h3 class="text-lg font-semibold mb-4">请输入访问密码</h3>
            <input type="password" id="loginPassword" class="w-full" placeholder="访问密码" />
            <button id="loginButton" class="btn btn-primary w-full mt-4">登录</button>
            <p id="loginError" class="text-red-500 text-sm mt-2 hidden">密码错误</p>
          </div>
        </div>`;
    document.body.appendChild(overlay);
    document.getElementById('loginPassword').focus();
    const submitLogin = async () => {
        const pwd = (document.getElementById('loginPassword').value || '').trim();
        try {
            const resp = await fetch('/api/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: pwd })
            });
            if (!resp.ok) {
                document.getElementById('loginError').classList.remove('hidden');
                return;
            }
            overlay.remove();
        } catch (_) {
            document.getElementById('loginError').classList.remove('hidden');
        }
    };
    document.getElementById('loginButton').addEventListener('click', submitLogin);
    document.getElementById('loginPassword').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') submitLogin();
    });
}
