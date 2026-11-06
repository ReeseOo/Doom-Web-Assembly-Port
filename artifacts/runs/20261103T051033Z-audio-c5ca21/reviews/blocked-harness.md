# Missing review/QA prerequisites

Integration reviewer invoked three times (initial, retry, final revision); qa_browser invoked twice. Every call failed before agent startup with:

`harness claude-code failed: start: exec: "claude": executable file not found in $PATH`

No integration or gameplay QA verdict obtained. Coordinator did not impersonate either role. Restore claude executable in the agent harness PATH, then resume both roles.
