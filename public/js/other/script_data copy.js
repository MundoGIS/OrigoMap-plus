function deleteFile(fileName) {
  fetch(`/data/api/files/${fileName}`, { method: 'DELETE' })
    .then(response => response.json())
    .then(result => {
      console.log(result);
      loadFiles();
    })
    .catch(error => {
      console.error(error);
    });
}

function downloadFile(fileName) {
  const fileExtension = fileName.split('.').pop();
  if (fileExtension !== 'folder') {
    window.location.href = `/data/api/files/${fileName}`;
  }
}

function addFileToList(file) {
  if (file && typeof file.name === 'string' && file.type !== 'folder' && file.name !== 'geodata') {
    const fileList = document.getElementById('fileList');
    const listItem = document.createElement('div');
    listItem.className = 'box';

    const fileName = file.name;
    const fileExtension = fileName.split('.').pop();
    const media = document.createElement('article');
    media.className = 'media';

    const mediaLeft = document.createElement('div');
    mediaLeft.className = 'media-left';
    const figure = document.createElement('figure');
    figure.className = 'image is-24x24';
    const img = document.createElement('img');
    img.src = fileExtension === 'gpkg' || fileExtension === 'shp' ? '/public/css/icons/gpkg.png' : '/public/css/icons/shp.png';

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
    deleteButton.onclick = () => deleteFile(file.name);
    buttons.appendChild(deleteButton);

    const downloadButton = createButton('Download', 'is-info');
    downloadButton.onclick = () => downloadFile(file.name);
    buttons.appendChild(downloadButton);

    listItem.appendChild(media);
    listItem.appendChild(buttons);
    fileList.appendChild(listItem);
  }
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
    .then(files => {
      const fileList = document.getElementById('fileList');
      fileList.innerHTML = '';
      if (Array.isArray(files)) {
        files.forEach(file => {
          addFileToList(file);
        });
      }
    })
    .catch(error => {
      console.error(error);
    });
}

loadFiles();
