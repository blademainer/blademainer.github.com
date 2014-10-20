#!/bin/bash
echo " ---------------------- status ---------------------- "
git status
echo " ---------------------- add ---------------------- "
git add -Av
echo " ---------------------- commit ---------------------- "
git commit -m common_commit
echo " ---------------------- push ---------------------- "
git push
echo " ---------------------- complete ---------------------- "
sleep 2