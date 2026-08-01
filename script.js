/******************************************************************************
 Script.js
 ******************************************************************************/

/******************************************************************************
 Các biến toàn cục
 ******************************************************************************/ 

// Link worker
const WEB_APP_URL = "https://icy-frog-35e9.hanhborn.workers.dev/";

// Biến lưu toàn bộ danh sách học sinh kể cả lấy được ở google sheet và tạo mới
let studentManager = [];

// Biến trạng thái của mỗi học sinh
const StudentState = {
    NORMAL: 0,
    MODIFIED: 1,
    NEW: 2
};

// Biến chọn chỗ ngồi khi bấm vào chỗ ngồi trong sơ đồ lớp
let selectedSeat = null;

// Biến chọn học sinh khi bấm vào chỗ ngồi có học sinh hoặc bấm chọn học sinh sau khi tìm
let selectedStudent = null;

// Biến thông tin học sinh gốc khi bấm chỉnh sửa
let originalStudent = null;

// Biến đếm xem có bao nhiêu học sinh đã được điểm danh
let count = 0;

// Khai báo các hộp thoại
const dlgEdit = document.getElementById("dlgEdit");
const dlgSearch = document.getElementById("dlgSearch");
const dlgConfirm = document.getElementById("dlgConfirm");
const dlgLoading = document.getElementById("dlgLoading");
const dlgSuccess = document.getElementById("dlgSuccess");
const dlgError = document.getElementById("dlgError");

// Khai báo các ô điền lớp, cột điểm danh và số buổi đã học
const classStudent = document.getElementById("chonLop");
const column = document.getElementById("nhapCot");
const numColumn = document.getElementById("soCot");

/******************************************************************************
 Hàm lấy danh sách học sinh từ Google sheet
 ******************************************************************************/
async function loadStudents() {
    // Khóa giao diện
    classStudent.disabled = true;
    column.disabled = true;
    numColumn.disabled = true;
    btnLayThongTin.disabled = true;

    btnLayThongTin.textContent = "Đang lấy thông tin...";

    const data = {
        action: "getStudents",
        class: document.getElementById("chonLop").value,
        column: document.getElementById("nhapCot").value.trim().toUpperCase(),
        numColumn: Number(document.getElementById("soCot").value)
    };

    try {
        const response = await fetch(WEB_APP_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        });
        const result = await response.json();
        //const text = await response.text();
        //console.log(text);
        //const result = JSON.parse(text);
        if (!result.success) {
            alert(result.message);
            return;
        }

        //Ghi thông tin lấy được vào biến studentManager
        studentManager = result.students.map(student => ({
            ...student,

            // Không ghi vào chỗ ngồi của học sinh những học sinh vắng học
            seat: /^(10|[1-9])[A-H]$/.test(student.seat)
            ? student.seat
            : "",

            // Ghi thêm vào trường trạng thái
            // Normal = bình thường; Modified = đã có chỉnh sửa; New = được tạo mới
            state: StudentState.NORMAL
        }));

        // Hiển thị sơ đồ lớp
        renderSeatMap(studentManager);
        console.log(studentManager);

    }
    catch (err) {
        alert(err.message);
        // Mở giao diện
        classStudent.disabled = false;
        column.disabled = false;
        numColumn.disabled = false;
        btnLayThongTin.disabled = false;

        btnLayThongTin.textContent = "Lấy thông tin";
    }
}

/******************************************************************************
 Hàm Hiển thị sơ đồ lớp
 ******************************************************************************/
function renderSeatMap(students = []) {
    btnLayThongTin.textContent = "Đã lấy thông tin thành công";
    const seatMap = document.getElementById("seatMap");
    seatMap.innerHTML = "";
    
    // Tạo 80 vị trí ngồi chia làm 2 dãy, mỗi dãy 10 bàn, mỗi bàn có 4 chỗ ngồi
    const columns = ["A", "B", "C", "D", "", "E", "F", "G", "H"];
    for (let row = 10; row >= 1; row--) {
        columns.forEach(column => {
            if (column === "") {
                const gap = document.createElement("div");
                gap.className = "seat-gap";
                seatMap.appendChild(gap);
                return;
            }
            const seatId = `${row}${column}`;
            const seat = document.createElement("div");
            seat.dataset.id = seatId;
            seat.textContent = seatId;

            // Kiểm tra có học sinh ngồi ghế này không
            const student = students.find(s => s.seat === seatId);
            
            // Nếu ghế có HS ngồi thì tô màu xanh lá
            if (student) {
                seat.className = "seat seat-full";
            }

            // Nếu ghế trống thì tô màu đỏ
            else {
                seat.className = "seat seat-empty";
            }

            //Khi bấm vào 1 chỗ ngồi
            seat.addEventListener("click", () => {
                selectedSeat = seatId;
                selectedStudent = studentManager.find(s => s.seat === seatId) ?? null;

                // Hiển thị thông tin học sinh
                showSeatInfo(selectedStudent);

                // Đổi màu ô được chọn thành màu vàng
                highlightSeat(seatId);

                if (selectedStudent !== null) {
                    btnXoa.disabled = false;
                    btnSua.disabled = false;
                    btnTim.disabled = true;
                    btnMoi.disabled = true;                     
                }
                else {
                    btnXoa.disabled = true;
                    btnSua.disabled = true;                    
                    btnTim.disabled = false;
                    btnMoi.disabled = false;                    
                }
            });

            //Cập nhật số lượng học sinh đã điểm danh
            updateSeatCount();
            updateButton();
            seatMap.appendChild(seat);
        });
    }
}

/******************************************************************************
 Hàm Hiển thị thông tin học sinh khi chọn ghế
 ******************************************************************************/
function showSeatInfo(student) {
    document.getElementById("infoHo").textContent = student ? student.lastName : "";
    document.getElementById("infoTen").textContent = student ? student.firstName : "";
    document.getElementById("infoPH").textContent = student ? student.infoParent : "";
    document.getElementById("infoHS").textContent = student ? student.infoStudent : "";
    document.getElementById("infoTruong").textContent = student ? student.school : "";
    if (!student) {
        document.getElementById("infoStatus").textContent = "";
        return;
    }
    switch (student.state) {
        case StudentState.NORMAL:
            document.getElementById("infoStatus").textContent = "Bình thường";
            break;
        case StudentState.MODIFIED:
            document.getElementById("infoStatus").textContent = "Đã chỉnh sửa";
            break;
        case StudentState.NEW:
            document.getElementById("infoStatus").textContent = "Thêm mới";
            break;
    }
}

/******************************************************************************
 Hàm highlight ghế đã chọn
 ******************************************************************************/
function highlightSeat(seatId) {

    // Bỏ chọn tất cả ghế
    document.querySelectorAll("#seatMap .seat").forEach(seat => {
        seat.classList.remove("seat-selected");
    });

    // Chọn ghế hiện tại
    const seat = document.querySelector(`#seatMap [data-id="${seatId}"]`);

    if (seat) {
        seat.classList.add("seat-selected");
    }
}

/******************************************************************************
 * Cập nhật số học sinh đã điểm danh
 ******************************************************************************/
function updateSeatCount() {
    count = studentManager.filter(student => student.seat).length;
    document.getElementById("seatCount").textContent = count;
}

/******************************************************************************
 Hàm thêm mới học sinh chưa đăng kí
 ******************************************************************************/
function addStudent() {

    const editHo = document.getElementById("editHo");
    const editTen = document.getElementById("editTen");
    const editPH = document.getElementById("editPH");
    const editHS = document.getElementById("editHS");
    const editTruong = document.getElementById("editTruong");

    // Ghi dữ liệu lên giao diện
    editHo.value = "";
    editTen.value = "";
    editPH.value = "";
    editHS.value = "";
    editTruong.value = "";

    // Lưu dữ liệu gốc để so sánh
    originalStudent = {
        lastName: "",
        firstName: "",
        infoParent: "",
        infoStudent: "",
        school: ""
    };

    // Ban đầu chưa có thay đổi
    btnLuu.disabled = true;

    // Theo dõi thay đổi
    const checkChanged = () => {
        btnLuu.disabled = !(
            editHo.value.trim()      !== originalStudent.lastName ||
            editTen.value.trim()     !== originalStudent.firstName ||
            editPH.value.trim()      !== originalStudent.infoParent ||
            editHS.value.trim()      !== originalStudent.infoStudent ||
            editTruong.value.trim()  !== originalStudent.school
        );
    };

    editHo.oninput = checkChanged;
    editTen.oninput = checkChanged;
    editPH.oninput = checkChanged;
    editHS.oninput = checkChanged;
    editTruong.oninput = checkChanged;

    // Hiển thị hộp thoại
    dlgEdit.showModal();

}

/******************************************************************************
 Hàm chỉnh sửa học sinh đã đăng kí nhưng chưa đủ thông tin
 ******************************************************************************/
function editStudent() {
    if (!selectedStudent) {
        alert("Ghế chưa có học sinh.");
        return;
    }
    const editHo = document.getElementById("editHo");
    const editTen = document.getElementById("editTen");
    const editPH = document.getElementById("editPH");
    const editHS = document.getElementById("editHS");
    const editTruong = document.getElementById("editTruong");

    // Ghi dữ liệu lên giao diện
    editHo.value = selectedStudent.lastName;
    editTen.value = selectedStudent.firstName;
    editPH.value = selectedStudent.infoParent;
    editHS.value = selectedStudent.infoStudent;
    editTruong.value = selectedStudent.school;

    // Lưu dữ liệu gốc để so sánh
    originalStudent = {
        lastName: selectedStudent.lastName,
        firstName: selectedStudent.firstName,
        infoParent: selectedStudent.infoParent,
        infoStudent: selectedStudent.infoStudent,
        school: selectedStudent.school
    };

    // Ban đầu chưa có thay đổi
    btnLuu.disabled = true;

    // Theo dõi thay đổi
    const checkChanged = () => {
        btnLuu.disabled = !(
            editHo.value.trim()      !== originalStudent.lastName ||
            editTen.value.trim()     !== originalStudent.firstName ||
            editPH.value.trim()      !== originalStudent.infoParent ||
            editHS.value.trim()      !== originalStudent.infoStudent ||
            editTruong.value.trim()  !== originalStudent.school
        );
    };

    editHo.oninput = checkChanged;
    editTen.oninput = checkChanged;
    editPH.oninput = checkChanged;
    editHS.oninput = checkChanged;
    editTruong.oninput = checkChanged;

    // Hiển thị hộp thoại
    dlgEdit.showModal();

}

/******************************************************************************
 * Tìm học sinh chưa có chỗ ngồi
 ******************************************************************************/
function searchStudent() {
    const btnGan = document.getElementById("btnGan");
    
    // Reset trạng thái
    selectedStudent = null;
    document.getElementById("searchText").value = "";
    document.getElementById("searchResult").innerHTML = "";
    btnGan.disabled = true;
    dlgSearch.showModal();
    document.getElementById("btnSearch").onclick = doSearch;
    document.getElementById("btnThoat").onclick = () => {
        selectedStudent = null;
        btnGan.disabled = true;
        dlgSearch.close();
    };
    btnGan.onclick = function () {
    if (!selectedStudent) {
        alert("Chưa chọn học sinh.");
        return;
    }
    selectedStudent.seat = selectedSeat;
    dlgSearch.close();
    renderSeatMap(studentManager);
    showSeatInfo(selectedStudent);
    highlightSeat(selectedSeat);
    btnXoa.disabled = false;
    btnSua.disabled = false;
    btnTim.disabled = true;
    btnMoi.disabled = true;
    };
}

/******************************************************************************
 * Hàm này hoạt động khi bấm nút Lưu
 ******************************************************************************/
function saveStudent() {

    // Thêm mới
    if (selectedStudent == null) {
        const student = {
            row: 0,
            lastName: document.getElementById("editHo").value.trim(),
            firstName: document.getElementById("editTen").value.trim(),
            infoParent: document.getElementById("editPH").value.trim(),
            infoStudent: document.getElementById("editHS").value.trim(),
            school: document.getElementById("editTruong").value.trim(),
            seat: selectedSeat,
            state: StudentState.NEW
        };
        studentManager.push(student);
        selectedStudent = student;
        btnXoa.disabled = false;
        btnSua.disabled = false;
        btnTim.disabled = true;
        btnMoi.disabled = true;   
    }

    // Chỉnh sửa
    else {
        selectedStudent.lastName = document.getElementById("editHo").value.trim();
        selectedStudent.firstName = document.getElementById("editTen").value.trim();
        selectedStudent.infoParent = document.getElementById("editPH").value.trim();
        selectedStudent.infoStudent = document.getElementById("editHS").value.trim();
        selectedStudent.school = document.getElementById("editTruong").value.trim();

        // Nếu không phải học sinh mới thì đánh dấu đã sửa
        if (selectedStudent.state != StudentState.NEW) {
            selectedStudent.state = StudentState.MODIFIED;
        }
    }

    // Đóng hộp thoại
    dlgEdit.close();

    // Cập nhật giao diện
    renderSeatMap(studentManager);
    showSeatInfo(selectedStudent);
    highlightSeat(selectedSeat);
}

/******************************************************************************
 * Hàm tìm theo tên học sinh chưa có chỗ ngồi
 ******************************************************************************/
function doSearch() {
    const keyword = document
        .getElementById("searchText")
        .value
        .trim()
        .toLowerCase();
    const resultDiv = document.getElementById("searchResult");
    resultDiv.innerHTML = "";

    //Chỉ lấy học sinh chưa có chỗ ngồi và tên khớp chính xác
    const list = studentManager.filter(student => {
        return (!student.seat || student.seat === "") &&
               student.firstName.toLowerCase()===keyword
    });
    if (list.length === 0) {
        resultDiv.innerHTML = "<p>Không tìm thấy học sinh.</p>";
        return;
    }

    //Hiển thị danh sách
    list.forEach(student => {
        const div = document.createElement("div");
        div.className = "search-item";
        div.textContent =
            student.lastName + " " + student.firstName + "(" + student.school + ")";
        div.onclick = () => {
            document
                .querySelectorAll(".search-item")
                .forEach(x => x.classList.remove("selected"));
            div.classList.add("selected");
            selectedStudent = student;
            document.getElementById("btnGan").disabled = false;
        };
        resultDiv.appendChild(div);
    });
}

/******************************************************************************
 * Xóa học sinh khỏi chỗ ngồi đang chọn
 ******************************************************************************/
function removeSeat() {
    // Xóa chỗ ngồi của học sinh
    selectedStudent.seat = "";

    // Reset 2 biến học sinh đang chọn và chỗ ngồi đang chọn
    selectedStudent = null;
    selectedSeat = null;

    // Cập nhật giao diện
    renderSeatMap(studentManager);
    showSeatInfo(null);
    btnMoi.disabled = true;
    btnSua.disabled = true;
    btnTim.disabled = true;
    btnXoa.disabled = true;
}

async function attendance() {
   dlgConfirm.showModal();
}

async function saveAttendance() {
    dlgConfirm.close();
    dlgLoading.showModal();

    const students = studentManager
        .filter(student => student.seat !== "")
        .map(student => {
            switch (student.state) {

                // Bình thường
                case StudentState.NORMAL:
                    return {
                        state: StudentState.NORMAL,
                        row: student.row,
                        seat: student.seat
                    };

                    // Đã chỉnh sửa
                case StudentState.MODIFIED:
                    return {
                        state: StudentState.MODIFIED,
                        row: student.row,
                        lastName: student.lastName,
                        firstName: student.firstName,
                        infoParent: student.infoParent,
                        infoStudent: student.infoStudent,
                        school: student.school,
                        seat: student.seat
                    };

                // Học sinh mới
                case StudentState.NEW:
                    return {
                        state: StudentState.NEW,
                        lastName: student.lastName,
                        firstName: student.firstName,
                        infoParent: student.infoParent,
                        infoStudent: student.infoStudent,
                        school: student.school,
                        seat: student.seat
                    };
            }
    });

    const data = {
        action: "attendance",
        class: document.getElementById("chonLop").value,
        column: document.getElementById("nhapCot").value.trim().toUpperCase(),
        students: students,
        count: count
    };
    try {
        const response = await fetch(WEB_APP_URL,{
            method:"POST",
            headers:{
                "Content-Type":"application/json"
            },
            body:JSON.stringify(data)
        });
        const result = await response.json();
        dlgLoading.close();
        if(result.success){
            dlgSuccess.showModal();
        }else{
            dlgError.showModal();
        }
    }
    catch(e){
        dlgLoading.close();
        dlgError.showModal();
    }
}

//Các nút bấm
const btnLayThongTin = document.getElementById("btnLayThongTin");
    btnLayThongTin.onclick = loadStudents;
const btnMoi = document.getElementById("btnMoi");
    btnMoi.onclick = addStudent;
const btnSua = document.getElementById("btnSua");
    btnSua.onclick = editStudent;
const btnTim = document.getElementById("btnTim");
    btnTim.onclick = searchStudent;
const btnXoa = document.getElementById("btnXoa");
    btnXoa.onclick = removeSeat;
const btnLuu = document.getElementById("btnLuu");
    btnLuu.onclick = saveStudent;
const btnHuy = document.getElementById("btnHuy");
    btnHuy.onclick = () => {dlgEdit.close();};
const btnAttendance = document.getElementById("btnAttendance");
    btnAttendance.onclick = attendance;
const btnYes = document.getElementById("btnYes");
    btnYes.onclick = saveAttendance;
const btnNo = document.getElementById("btnNo");
    btnNo.onclick = () => {dlgConfirm.close();};
const btnBack = document.getElementById("btnBack");
    btnBack.onclick = () => {dlgSuccess.close();};
const btnF5 = document.getElementById("btnF5");
    btnF5.onclick = () => {location.reload();};
const btnBackError = document.getElementById("btnBackError");
    btnBackError.onclick = () => {dlgError.close();};

// Hàm Enable-Disnable các nút bấm
async function updateButton() {
    btnAttendance.disabled = !(count > 0);
    btnLayThongTin.disabled = !(classStudent.value 
        && column.value 
        && numColumn.value 
        && studentManager.length === 0);

}

//Disnable tất cả các nút bấm
btnLayThongTin.disabled = true;
btnMoi.disabled = true;
btnSua.disabled = true;
btnTim.disabled = true;
btnXoa.disabled = true;

updateButton();
document.getElementById("chonLop").addEventListener("change", updateButton);
document.getElementById("nhapCot").addEventListener("input", updateButton);
document.getElementById("soCot").addEventListener("change", updateButton);