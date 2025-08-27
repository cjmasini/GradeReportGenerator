from typing import Callable, Optional

from .attendanceData import AttendanceData
from .translate import translate
from .util import sanitize_input
from .student import Student

ProgressFn = Optional[Callable[[int], None]]


class LetterWriter:
    def __init__(self, name, email, language, custom_message, attendanceData: dict[str, AttendanceData], progress_cb: ProgressFn = None):
        self.teacher_name = sanitize_input(name)
        self.teacher_email = sanitize_input(email)
        self.language = sanitize_input(language)
        self.custom_message = sanitize_input(custom_message)
        self.should_translate = True
        self.attendance_data = attendanceData
        self._progress = progress_cb or (lambda _p: None)

        self.message = "To the Parent/Guardian of {},\n"
        if len(self.attendance_data) > 0:
            self.message += "\tThis letter is to let you know that {} currently has a grade of {} ({}) in their {} class and has {} missing assignments, {} tardies, and {} absences. "
        else:
            self.message += "\tThis letter is to let you know that {} currently has a grade of {} ({}) in their {} class and has {} missing assignments. "
        self.message += custom_message + " "
        self.message += "If you have any questions or concerns, please do not hesitate to contact me at {}\n\n"

        if language == "en":
            self.should_translate = False
            ltr = pdf = ""
        elif language == "ar":
            ltr = "\u202A"
            pdf = "\u202C"
        else:
            ltr = pdf = ""

        self.translated_message = ""
        self.missing_assignments_text = ""
        self.forms = ""

        if self.should_translate:
            self.translated_message += translate("To the Parent/Guardian of", language) + f" {ltr}{{}}{pdf},\n"
            self.translated_message += "\t" + translate("This letter is to let you know that", language) + f" {ltr}{{}}{pdf} "
            self._progress(30)
            self.translated_message += translate("currently has a grade of", language) + f" {ltr}{{}} ({{}}){pdf} "
            self.translated_message += translate("in their", language).lower() + f" {ltr}{{}}{pdf} "
            self._progress(40)
            self.translated_message += translate("class and has", language) + f" {ltr}{{}}{pdf} "
            if len(self.attendance_data) > 0:
                self.translated_message += translate("missing assignments", language).lower() + f", {ltr}{{}}{pdf} "
                self.translated_message += translate("tardies", language).lower() + ", "
                self.translated_message += translate("and", language).lower() + f" {ltr}{{}}{pdf} "
                self.translated_message += translate("absences", language).lower()
            else:
                self.translated_message += translate("missing assignments", language)
            self.translated_message += ". "
            self._progress(50)
            self.translated_message += translate(custom_message, language) + " "
            self.translated_message += translate(
                f"If you have any questions or concerns, please do not hesitate to contact me at {email}",
                language
            ) + "\n\n"
            self._progress(60)

            self.missing_assignments_text = "\nMissing Assignments / " + translate("Missing Assignments", self.language) + ":\n"
            self.forms += "Student Name / " + translate("Student Name", self.language) + ": _______________________________\n\n"
            self._progress(70)
            self.forms += "Parent Name / " + translate("Parent Name", self.language) + ": _______________________________\n\n"
            self._progress(80)
            self.forms += "Parent Signature / " + translate("Parent Signature", self.language) + ": ______________________________\n\n"
            self.forms += "Date / " + translate("Date", self.language) + ": _______________________________\n\n"
            self._progress(90)
        else:
            self.forms += "Student Name: _______________________________\n\n"
            self.forms += "Parent Name: _______________________________\n\n"
            self.forms += "Parent Signature: ______________________________\n\n"
            self.forms += "Date: _______________________________\n\n"

    def generate_letter(self, student: Student):
        text = ""
        if len(self.attendance_data) > 0 and student.name in self.attendance_data:
            tardies = self.attendance_data[student.name].tardy
            absences = self.attendance_data[student.name].absent
            text = self.message.format(
                student.display_name,
                student.first_name,
                student.percent,
                student.grade,
                student.subject,
                len(student.missing_assignments),
                tardies,
                absences,
                self.teacher_email
            )
        else:
            text = self.message.format(
                student.display_name,
                student.first_name,
                student.percent,
                student.grade,
                student.subject,
                len(student.missing_assignments),
                self.teacher_email
            )

        if self.should_translate:
            if len(self.attendance_data) > 0 and student.name in self.attendance_data:
                tardies = self.attendance_data[student.name].tardy
                absences = self.attendance_data[student.name].absent
                text += self.translated_message.format(
                    student.display_name,
                    student.first_name,
                    student.percent,
                    student.grade,
                    student.subject,
                    len(student.missing_assignments),
                    tardies,
                    absences
                )
            else:
                text += self.translated_message.format(
                    student.display_name,
                    student.first_name,
                    student.percent,
                    student.grade,
                    student.subject,
                    len(student.missing_assignments),
                )

        if len(student.missing_assignments) > 0:
            text += self.missing_assignments_text
            for assignment in student.missing_assignments:
                text += f"\t{assignment}\n"
            text += "\n"
        text += self.forms
        text += f"{self.teacher_name}\n{student.subject} Teacher\n{self.teacher_email}"

        self._progress(90)
        return text