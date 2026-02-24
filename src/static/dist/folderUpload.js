const sizeThreshold = 300 * 1024 * 1024; // 300 MiB
const totalSizeThreshold = 5000 * 1024 * 1024 // 5 Gig

// folderUploadURL is defined in the template
// form constants
const form = document.querySelector("form#folderUpload");
const filesFieldName = "uploadFolder";

// modal constants
const filesModal = document.getElementById("folderUploadModal");
const modalBody = filesModal.querySelector(".modal-body");
const tableBody = modalBody.querySelector("tbody");
const submitButton = filesModal.querySelector("button#sendFile");


const units = ['bytes', 'KiB', 'MiB', 'GiB'];
   
function humanizeSize(x){

  let l = 0, n = parseInt(x, 10) || 0;
  while(n >= 1024 && ++l){
      n = n/1024;
  }
  return(n.toFixed(n < 10 && l > 0 ? 1 : 0) + ' ' + units[l]);
}


function listBigFiles(bigFiles) {
    if (bigFiles.length > 0) {
        const detailsDiv = modalBody.querySelector("div#details");
        const details = document.createElement("details");
        const summary = document.createElement("summary");
        summary.innerHTML = `Files larger than ${humanizeSize(sizeThreshold)} will be ignored.`;
        const ul = document.createElement("ul");
        bigFiles.forEach((file) => {
            const li = document.createElement("li");
            li.innerHTML = `${file.webkitRelativePath} (${humanizeSize(file.size)})`;
            ul.appendChild(li);
        });
        details.appendChild(summary);
        details.appendChild(ul);
        detailsDiv.appendChild(details);
    }
}

function createRowForFile(file, filesToIgnore) {
    const row = document.createElement("tr");
    row.setAttribute("data-filename", file.webkitRelativePath);

    
    const fnameCell = document.createElement("td");
    fnameCell.className = "text-truncate"; //or text-wrap
    fnameCell.innerHTML = file.webkitRelativePath;
    
    const sizeCell =  document.createElement("td");
    sizeCell.innerHTML = humanizeSize(file.size);
    
    const deleteButtonCell = document.createElement("td");
    
    const deleteButton = document.createElement("button");
    deleteButton.className = "btn btn-danger"
    deleteButton.type = "button"
    deleteButton.innerHTML = "<i class='bi bi-trash'></i>";
    deleteButtonCell.appendChild(deleteButton);
    
    [fnameCell, sizeCell, deleteButtonCell].forEach((cell) => row.appendChild(cell));
    
    tableBody.appendChild(row);
    
    deleteButton.addEventListener("click", () => {
        row.remove();
        filesToIgnore.push(file.webkitRelativePath);
        let totalSize = document.getElementById("totalSize");
        let newTotalSize = totalSize.dataset.bytes - file.size;
        totalSize.innerHTML = humanizeSize(newTotalSize);
        totalSize.dataset.bytes = newTotalSize;

        if (newTotalSize <= totalSizeThreshold && submitButton.disabled) {
        submitButton.disabled = false;
        document.getElementById("warningBadge").hidden = true;


        }
    });
}

function submitFiles(listOfFiles, filesToIgnore, csrf_token) {
    processedFiles = 0;
    listOfFiles.forEach(async (file) => {
        if (filesToIgnore.indexOf(file.webkitRelativePath) > -1) {
            processedFiles += 1;
        } else {
            const fileData = new FormData();
            fileData.append("csrf_token", csrf_token);
            fileData.append("uploadFolder", file, file.webkitRelativePath);

            const response = await fetch(folderUploadURL, {
                method: "POST",
                body: fileData
            });

            const result = await response.json();
            
            const button = tableBody.querySelector(`tr[data-filename="${file.webkitRelativePath}"] button`);
            if (result) {
                if (result.status == "OK") {
                    button.classList.replace("btn-danger", "btn-success");
                    button.querySelector("i").classList.replace("bi-trash", "bi-check-lg");

                } else {
                    button.querySelector("i").classList.replace("bi-trash", "bi-bug");
                    console.log(result.status);
                }  
                processedFiles += 1;
                if (processedFiles == listOfFiles.length) {
                    submitButton.querySelector("span.spinner-border").classList.add("visually-hidden");
                    submitButton.innerHTML = "Refresh page";
                    submitButton.addEventListener("click", () => {
                        location.reload();
                    });
                }
            }
        }
    });
}


function checkTotalSize(data) {
    let totalSize = 0;
    [...data.getAll(filesFieldName)].forEach( (x) => {
        if(x.size < sizeThreshold) {
            totalSize += x.size;
        }
    })
    return totalSize;
}

function appendTotalSize(total) {

    const row = document.createElement("tr");
    row.innerHTML = `<td><b>Total size:</b></td> <td> <b id="totalSize" data-bytes=${total}>${humanizeSize(total)}</b> </td> <td></td>`
    tableBody.appendChild(row);


}

function listFilesToUpload() {
    const modal = new bootstrap.Modal(filesModal);
    modal.show();

    const data = new FormData(form);
    const bigFiles = [...data.getAll(filesFieldName)].filter((file) => file.size >= sizeThreshold);
    listBigFiles(bigFiles);

    totalSize = checkTotalSize(data);

    const listOfFiles = [...data.getAll(filesFieldName)].filter((file) => file.size < sizeThreshold);
    const filesToIgnore = [];

    listOfFiles.forEach((file) => createRowForFile(file, filesToIgnore));
    appendTotalSize(totalSize);

    if (totalSize >= totalSizeThreshold) {
    submitButton.setAttribute("disabled", "disabled")
    document.getElementById("warningBadge").hidden = false;

    }


    submitButton.addEventListener("click", () => {
        submitButton.querySelector("span.spinner-border").classList.remove("visually-hidden");
        submitFiles(listOfFiles, filesToIgnore, data.get("csrf_token"));
    });

}

document.getElementById("uploadFolder").addEventListener("change", listFilesToUpload);