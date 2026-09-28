document.getElementById('uploadForm').addEventListener('submit', function (event) {
  event.preventDefault();

  const formData = new FormData(this);
  const uploadType = document.querySelector('input[name="uploadType"]:checked').value;
  console.log('uploadType selected:', uploadType);  // Log para verificar el tipo de archivo seleccionado
  formData.append('uploadType', uploadType);

  fetch('/data/api/files', {
    method: 'POST',
    body: formData
  })
    .then(response => response.json())
    .then(result => {
      console.log('Upload result:', result);  // Log para ver el resultado de la subida
      loadFiles();
    })
    .catch(error => {
      console.error('Upload error:', error);
    });
});

function deleteFile(fileName, type) {
  fetch(`/data/api/files/${fileName}?type=${type}`, { method: 'DELETE' })
    .then(response => response.json())
    .then(result => {
      console.log('Delete result:', result);  // Log para ver el resultado de la eliminación
      loadFiles();
    })
    .catch(error => {
      console.error('Delete error:', error);
    });
}

function downloadFile(fileName, type) {
  window.location.href = `/data/api/files/${fileName}?type=${type}`;
}

function addFileToList(file, container) {
  const listItem = document.createElement('div');
  listItem.className = 'box';
  const fileName = file.name;
  const media = document.createElement('article');
  media.className = 'media';

  const mediaLeft = document.createElement('div');
  mediaLeft.className = 'media-left';
  const figure = document.createElement('figure');
  figure.className = 'image is-24x24';
  const img = document.createElement('img');
  img.src = file.type === '2d' ? '/public/css/icons/2d.png' : '/public/css/icons/3d.png';

  figure.appendChild(img);
  mediaLeft.appendChild(figure);

  const mediaContent = document.createElement('div');
  mediaContent.className = 'media-content';
  const content = document.createElement('div');
  const fileNameElement = document.createElement('strong');
  fileNameElement.textContent = fileName;
  content.appendChild(fileNameElement);
  mediaContent.appendChild(content);

  media.appendChild(mediaLeft);
  media.appendChild(mediaContent);

  const buttons = document.createElement('div');
  buttons.className = 'buttons';
  const deleteButton = createButton('Delete', 'is-danger');
  deleteButton.onclick = () => deleteFile(file.name, file.type);
  buttons.appendChild(deleteButton);

  const downloadButton = createButton('Download', 'is-info');
  downloadButton.onclick = () => downloadFile(file.name, file.type);
  buttons.appendChild(downloadButton);

  listItem.appendChild(media);
  listItem.appendChild(buttons);
  container.appendChild(listItem);
}

function createButton(text, className) {
  const button = document.createElement('button');
  button.className = `button ${className}`;
  button.textContent = text;
  return button;
}

function loadFiles() {
  fetch('/data/api/files')
    .then(response => response.json())
    .then(data => {
      const fileList2D = document.getElementById('fileList2D');
      const fileList3D = document.getElementById('fileList3D');
      fileList2D.innerHTML = '';
      fileList3D.innerHTML = '';

      data.files2D.forEach(file => {
        addFileToList(file, fileList2D);
      });

      data.files3D.forEach(file => {
        addFileToList(file, fileList3D);
      });
    })
    .catch(error => {
      console.error('Load files error:', error);
    });
}

loadFiles();
